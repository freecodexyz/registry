import { isAddress } from "viem";
import type {
    HexAddress,
    SwapApprovalRequest,
    SwapApprovalResult,
    SwapBuildRequest,
    SwapBuildResult,
    SwapProvider,
    SwapQuoteRequest,
    SwapQuoteResult,
    SwapStatusRequest,
    TransactionRequest,
} from "./types";
import { NATIVE_TOKEN_ADDRESS, SwapProviderError } from "./types";

type FetchOptions = Readonly<{
    method: "GET" | "POST";
    path: string;
    body?: unknown;
    query?: URLSearchParams;
}>;

type FetchRequest = Readonly<{
    method: string;
    headers: Readonly<Record<string, string>>;
    body?: string;
    signal: AbortSignal;
}>;

type FetchResponse = Readonly<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
}>;

export type UniswapFetch = (url: URL, init: FetchRequest) => Promise<FetchResponse>;
type GlobalFetch = (input: URL, init: FetchRequest) => Promise<FetchResponse>;

type ParsedJson =
    | { kind: "empty" }
    | { kind: "json"; value: unknown }
    | { kind: "text"; value: string };

const DEFAULT_UNISWAP_API_URL = "https://trade-api.gateway.uniswap.org/v1";
const REQUEST_TIMEOUT_MS = 15_000;

export class UniswapSwapProvider implements SwapProvider {
    readonly #apiKey: string | undefined;
    readonly #baseUrl: string;
    readonly #fetch: UniswapFetch;

    constructor(
        apiKey: string | undefined,
        baseUrl = DEFAULT_UNISWAP_API_URL,
        fetcher: UniswapFetch = fetch as unknown as GlobalFetch,
    ) {
        this.#apiKey = apiKey;
        this.#baseUrl = baseUrl;
        this.#fetch = fetcher;
    }

    async checkApproval(request: SwapApprovalRequest): Promise<SwapApprovalResult> {
        if (request.token.toLowerCase() === NATIVE_TOKEN_ADDRESS) {
            return { approval: null, cancel: null, raw: { skipped: "native-token" } };
        }

        const payload = await this.#request({
            method: "POST",
            path: "/check_approval",
            body: {
                chainId: request.chainId,
                walletAddress: request.walletAddress,
                token: request.token,
                amount: request.amount,
                urgency: "normal",
                includeGasInfo: true,
            },
        });

        return parseApprovalResult(payload);
    }

    async quote(request: SwapQuoteRequest): Promise<SwapQuoteResult> {
        const payload = await this.#request({
            method: "POST",
            path: "/quote",
            body: {
                type: request.type,
                tokenIn: request.tokenIn,
                tokenOut: request.tokenOut,
                tokenInChainId: request.chainId,
                tokenOutChainId: request.chainId,
                amount: request.amount,
                swapper: request.swapper,
                slippageTolerance: request.slippageTolerance,
                permitAmount: request.permitAmount,
                routingPreference: request.routingPreference,
            },
        });

        return parseQuoteResult(payload);
    }

    async buildSwap(request: SwapBuildRequest): Promise<SwapBuildResult> {
        const body: Record<string, unknown> = {
            quote: request.quote,
            simulateTransaction: true,
            refreshGasPrice: true,
            safetyMode: "SAFE",
            urgency: "normal",
        };

        if (request.permitData && request.signature) {
            body.permitData = request.permitData;
            body.signature = request.signature;
        }

        const payload = await this.#request({ method: "POST", path: "/swap", body });
        return parseBuildResult(payload);
    }

    async getSwapStatus(request: SwapStatusRequest): Promise<unknown> {
        const query = new URLSearchParams({
            chainId: String(request.chainId),
            txHashes: request.txHashes.join(","),
        });
        return await this.#request({ method: "GET", path: "/swaps", query });
    }

    async #request(options: FetchOptions): Promise<unknown> {
        if (!this.#apiKey) {
            throw new SwapProviderError("UNISWAP_API_KEY is not configured", { code: "missing_uniswap_api_key" });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const url = new URL(stripLeadingSlash(options.path), withTrailingSlash(this.#baseUrl));
            if (options.query) url.search = options.query.toString();

            const request: {
                method: string;
                headers: Readonly<Record<string, string>>;
                body?: string;
                signal: AbortSignal;
            } = {
                method: options.method,
                headers: {
                    "x-api-key": this.#apiKey,
                    "content-type": "application/json",
                    "accept": "application/json",
                },
                signal: controller.signal,
            };
            if (options.body !== undefined) request.body = JSON.stringify(options.body);

            const response = await this.#fetch(url, request);
            const payload = await readResponsePayload(response);

            if (!response.ok) {
                throw new SwapProviderError(readErrorMessage(payload, response.status), {
                    code: `uniswap_${response.status}`,
                    retriable: response.status === 429 || response.status >= 500,
                    statusCode: response.status,
                    details: payload.kind === "empty" ? null : payload.value,
                });
            }

            return unwrapPayload(payload);
        } catch (err) {
            if (err instanceof SwapProviderError) throw err;
            if (err instanceof Error && err.name === "AbortError") {
                throw new SwapProviderError("Uniswap request timed out", { code: "uniswap_timeout", retriable: true });
            }
            throw new SwapProviderError(err instanceof Error ? err.message : "Uniswap request failed", { code: "uniswap_request_failed", retriable: true });
        } finally {
            clearTimeout(timeout);
        }
    }
}

function parseApprovalResult(payload: unknown): SwapApprovalResult {
    const response = readRecord(payload, "approval response");
    return {
        approval: parseOptionalTransaction(response.approval, "approval"),
        cancel: parseOptionalTransaction(response.cancel, "cancel"),
        raw: payload,
    };
}

function parseQuoteResult(payload: unknown): SwapQuoteResult {
    const response = readRecord(payload, "quote response");
    const routing = parseOptionalString(response.routing, "routing");
    if (routing === "CHAINED") {
        throw new SwapProviderError("chained swaps are not supported by this endpoint", { code: "unsupported_routing", details: payload });
    }

    return {
        quote: "quote" in response ? response.quote : payload,
        permitData: response.permitData ?? null,
        routing,
        raw: payload,
    };
}

function parseBuildResult(payload: unknown): SwapBuildResult {
    const response = readRecord(payload, "swap response");
    return {
        transaction: parseRequiredTransaction(response.swap, "swap"),
        raw: payload,
    };
}

async function readResponsePayload(response: FetchResponse): Promise<ParsedJson> {
    const text = await response.text();
    if (!text) return { kind: "empty" };

    try {
        return { kind: "json", value: JSON.parse(text) as unknown };
    } catch {
        return { kind: "text", value: text };
    }
}

function unwrapPayload(payload: ParsedJson): unknown {
    switch (payload.kind) {
        case "empty":
            throw new SwapProviderError("Uniswap response body was empty", { code: "empty_uniswap_response" });
        case "json":
        case "text":
            return payload.value;
        default:
            return assertNever(payload);
    }
}

function readErrorMessage(payload: ParsedJson, statusCode: number): string {
    if (payload.kind === "json" && isRecord(payload.value)) {
        if (typeof payload.value.message === "string") return payload.value.message;
        if (typeof payload.value.error === "string") return payload.value.error;
    }

    if (payload.kind === "text" && payload.value) return payload.value;
    return `Uniswap request failed with HTTP ${statusCode}`;
}

function withTrailingSlash(value: string): string {
    return value.endsWith("/") ? value : `${value}/`;
}

function stripLeadingSlash(value: string): string {
    return value.startsWith("/") ? value.slice(1) : value;
}

function parseOptionalTransaction(value: unknown, name: string): TransactionRequest | null {
    if (value === undefined || value === null) return null;
    return parseRequiredTransaction(value, name);
}

function parseRequiredTransaction(value: unknown, name: string): TransactionRequest {
    const candidate = unwrapTransactionRecord(value, name);
    const to = readAddress(candidate.to, `${name}.to`);
    const from = readAddress(candidate.from, `${name}.from`);
    const data = readHex(candidate.data, `${name}.data`);
    const chainId = readChainId(candidate.chainId, `${name}.chainId`);

    const transaction: TransactionRequest = {
        to,
        from,
        data,
        value: parseOptionalString(candidate.value, `${name}.value`) ?? "0",
        chainId,
    };

    const gasLimit = parseOptionalString(candidate.gasLimit, `${name}.gasLimit`);
    const maxFeePerGas = parseOptionalString(candidate.maxFeePerGas, `${name}.maxFeePerGas`);
    const maxPriorityFeePerGas = parseOptionalString(candidate.maxPriorityFeePerGas, `${name}.maxPriorityFeePerGas`);
    const gasPrice = parseOptionalString(candidate.gasPrice, `${name}.gasPrice`);

    if (gasLimit) transaction.gasLimit = gasLimit;
    if (maxFeePerGas) transaction.maxFeePerGas = maxFeePerGas;
    if (maxPriorityFeePerGas) transaction.maxPriorityFeePerGas = maxPriorityFeePerGas;
    if (gasPrice) transaction.gasPrice = gasPrice;

    return transaction;
}

function unwrapTransactionRecord(value: unknown, name: string): Record<string, unknown> {
    const record = readRecord(value, name);
    if ("transaction" in record) return unwrapTransactionRecord(record.transaction, `${name}.transaction`);
    return record;
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
    if (!isRecord(value)) {
        throw new SwapProviderError(`Uniswap ${name} was not an object`, { code: "invalid_uniswap_response", details: value });
    }

    return value;
}

function readAddress(value: unknown, name: string): HexAddress {
    if (typeof value !== "string" || !isAddress(value)) {
        throw new SwapProviderError(`Uniswap ${name} was not a valid address`, { code: "invalid_uniswap_response", details: { [name]: value } });
    }

    return value as HexAddress;
}

function readHex(value: unknown, name: string): HexAddress {
    if (typeof value !== "string" || !value.startsWith("0x")) {
        throw new SwapProviderError(`Uniswap ${name} was not a hex string`, { code: "invalid_uniswap_response", details: { [name]: value } });
    }

    return value as HexAddress;
}

function readChainId(value: unknown, name: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new SwapProviderError(`Uniswap ${name} was not a valid chain id`, { code: "invalid_uniswap_response", details: { [name]: value } });
    }

    return value;
}

function parseOptionalString(value: unknown, name: string): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") {
        throw new SwapProviderError(`Uniswap ${name} was not a string`, { code: "invalid_uniswap_response", details: { [name]: value } });
    }

    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNever(value: never): never {
    throw new Error(`unhandled Uniswap response variant: ${JSON.stringify(value)}`);
}
