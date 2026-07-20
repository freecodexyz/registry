import { describe, expect, it } from "vitest";
import { SwapProviderError } from "./types";
import { UniswapSwapProvider, type UniswapFetch } from "./uniswap";
import type { HexAddress, SwapQuoteRequest, TransactionRequest } from "./types";

const ACCOUNT = "0x0000000000000000000000000000000000000001" as const;
const TOKEN_IN = "0x0000000000000000000000000000000000000002" as const;
const TOKEN_OUT = "0x0000000000000000000000000000000000000003" as const;
const ROUTER = "0x0000000000000000000000000000000000000004" as const;

describe("UniswapSwapProvider", () => {
    it("builds the approval request and parses nested approval transactions", async () => {
        const transaction = tx({ to: TOKEN_IN, from: ACCOUNT, data: "0x095ea7b3" });
        const calls: FetchCall[] = [];
        const provider = new UniswapSwapProvider("key", "https://example.test/v1/", fetchStub(calls, {
            approval: { transaction },
            cancel: null,
        }));

        const result = await provider.checkApproval({
            chainId: 8453,
            walletAddress: ACCOUNT,
            token: TOKEN_IN,
            amount: "1000000",
        });

        expect(result.approval).toEqual(transaction);
        expect(result.cancel).toBeNull();
        expect(calls).toHaveLength(1);
        expect(calls[0]?.url.href).toBe("https://example.test/v1/check_approval");
        expect(readBody(calls[0])).toMatchObject({
            chainId: 8453,
            walletAddress: ACCOUNT,
            token: TOKEN_IN,
            amount: "1000000",
        });
    });

    it("rejects malformed swap transactions at the response boundary", async () => {
        const provider = new UniswapSwapProvider("key", "https://example.test/v1/", fetchStub([], {
            swap: { to: ROUTER, from: ACCOUNT, value: "0", chainId: 8453 },
        }));

        await expectProviderError(
            provider.buildSwap({ quote: { quoteId: "quote-1" }, permitData: null, signature: null }),
            "invalid_uniswap_response",
        );
    });

    it("classifies Uniswap HTTP errors with retriable metadata", async () => {
        const provider = new UniswapSwapProvider("key", "https://example.test/v1/", fetchStub([], {
            message: "rate limited",
        }, 429));

        const error = await expectProviderError(provider.quote(quoteRequest()), "uniswap_429");

        expect(error.message).toBe("rate limited");
        expect(error.retriable).toBe(true);
        expect(error.statusCode).toBe(429);
    });

    it("fails before network access when the API key is missing", async () => {
        const calls: FetchCall[] = [];
        const provider = new UniswapSwapProvider(undefined, "https://example.test/v1/", fetchStub(calls, {}));

        await expectProviderError(provider.quote(quoteRequest()), "missing_uniswap_api_key");

        expect(calls).toEqual([]);
    });

    it("rejects chained routing as unsupported", async () => {
        const provider = new UniswapSwapProvider("key", "https://example.test/v1/", fetchStub([], {
            quote: { quoteId: "quote-1" },
            routing: "CHAINED",
        }));

        await expectProviderError(provider.quote(quoteRequest()), "unsupported_routing");
    });
});

type FetchCall = Readonly<{
    url: URL;
    init: Parameters<UniswapFetch>[1];
}>;

function fetchStub(calls: FetchCall[], payload: unknown, status = 200): UniswapFetch {
    return async (url, init) => {
        calls.push({ url, init });
        return {
            ok: status >= 200 && status < 300,
            status,
            async text() {
                return JSON.stringify(payload);
            },
        };
    };
}

function readBody(call: FetchCall | undefined): unknown {
    if (!call || !call.init.body) throw new Error("missing request body");
    return JSON.parse(call.init.body) as unknown;
}

async function expectProviderError(promise: Promise<unknown>, code: string): Promise<SwapProviderError> {
    try {
        await promise;
    } catch (err) {
        expect(err).toBeInstanceOf(SwapProviderError);
        const error = err as SwapProviderError;
        expect(error.code).toBe(code);
        return error;
    }

    throw new Error(`expected provider error ${code}`);
}

function quoteRequest(): SwapQuoteRequest {
    return {
        chainId: 8453,
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amount: "1000000",
        swapper: ACCOUNT,
        type: "EXACT_INPUT",
        slippageTolerance: 0.5,
        permitAmount: "FULL",
        routingPreference: "BEST_PRICE",
    };
}

function tx(input: { to: HexAddress; from: HexAddress; data: HexAddress }): TransactionRequest {
    return {
        to: input.to,
        from: input.from,
        data: input.data,
        value: "0",
        chainId: 8453,
    };
}
