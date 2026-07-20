import { erc20Abi } from "viem";
import type { Chain } from "viem";
import { base } from "viem/chains";
import type { TradableAsset } from "./assets";
import { NATIVE_TOKEN_ADDRESS, type HexAddress, type SwapProvider, type SwapQuoteRequest } from "./types";

export type WalletValueCacheState = "hit" | "miss" | "refresh";

export type WalletValueAsset =
    | Readonly<{
        status: "empty";
        address: HexAddress;
        symbol: string;
        balance: string;
        valueUsd: null;
        valueUsdBaseUnits: null;
    }>
    | Readonly<{
        status: "stable";
        address: HexAddress;
        symbol: string;
        balance: string;
        valueUsd: string;
        valueUsdBaseUnits: string;
    }>
    | Readonly<{
        status: "quoted";
        address: HexAddress;
        symbol: string;
        balance: string;
        valueUsd: string;
        valueUsdBaseUnits: string;
    }>
    | Readonly<{
        status: "unavailable";
        address: HexAddress;
        symbol: string;
        balance: string;
        valueUsd: null;
        valueUsdBaseUnits: null;
        error: string;
    }>;

export type WalletValueResult = Readonly<{
    status: "complete" | "partial";
    cache: WalletValueCacheState;
    walletAddress: HexAddress;
    chainId: number;
    quoteToken: Readonly<{
        address: HexAddress;
        symbol: string;
        decimals: number;
    }>;
    totalUsd: string;
    totalUsdBaseUnits: string;
    cachedAt: string;
    expiresAt: string;
    assets: readonly WalletValueAsset[];
}>;

export type WalletValueRequest = Readonly<{
    walletAddress: HexAddress;
    refresh: boolean;
}>;

export type WalletValueServiceOptions = Readonly<{
    assets: Pick<WalletValueAssets, "list">;
    quoteProvider: Pick<SwapProvider, "quote">;
    balanceReader: WalletValueBalanceReader;
    ttlMs?: number;
    now?: () => number;
}>;

export type WalletValueAssets = Readonly<{
    list(): Promise<TradableAsset[]>;
}>;

export type WalletValueBalanceReader = Readonly<{
    chainId: number;
    getNativeBalance(walletAddress: HexAddress): Promise<bigint>;
    getTokenBalances(walletAddress: HexAddress, assets: readonly TradableAsset[]): Promise<ReadonlyMap<string, bigint>>;
}>;

export type ViemBalanceClient = Readonly<{
    getBalance(args: { address: HexAddress }): Promise<bigint>;
    readContract(args: {
        address: HexAddress;
        abi: typeof erc20Abi;
        functionName: "balanceOf";
        args: readonly [HexAddress];
    }): Promise<bigint>;
    multicall(args: {
        allowFailure: true;
        contracts: readonly {
            address: HexAddress;
            abi: typeof erc20Abi;
            functionName: "balanceOf";
            args: readonly [HexAddress];
        }[];
    }): Promise<readonly unknown[]>;
}>;

type ComputedWalletValue = Omit<WalletValueResult, "cache">;
type CacheEntry = Readonly<{
    value: ComputedWalletValue;
    cachedAt: number;
}>;

const DEFAULT_WALLET_VALUE_TTL_MS = 60_000;
const USD_QUOTE_SYMBOL = "USDC";

export class WalletValueService {
    readonly #assets: Pick<WalletValueAssets, "list">;
    readonly #quoteProvider: Pick<SwapProvider, "quote">;
    readonly #balanceReader: WalletValueBalanceReader;
    readonly #ttlMs: number;
    readonly #now: () => number;
    readonly #cache = new Map<string, CacheEntry>();

    constructor(options: WalletValueServiceOptions) {
        this.#assets = options.assets;
        this.#quoteProvider = options.quoteProvider;
        this.#balanceReader = options.balanceReader;
        this.#ttlMs = options.ttlMs ?? DEFAULT_WALLET_VALUE_TTL_MS;
        this.#now = options.now ?? Date.now;
        if (!Number.isInteger(this.#ttlMs) || this.#ttlMs <= 0) throw new Error("wallet value TTL must be a positive integer");
    }

    async getWalletValue(request: WalletValueRequest): Promise<WalletValueResult> {
        const walletAddress = normalizeAddress(request.walletAddress);
        const key = cacheKey(this.#balanceReader.chainId, walletAddress);
        const now = this.#now();
        const hit = this.#cache.get(key);
        if (!request.refresh && hit && now - hit.cachedAt < this.#ttlMs) {
            return withCacheState(hit.value, "hit");
        }

        if (request.refresh) this.#cache.delete(key);

        const value = await this.#compute(walletAddress, now);
        this.#cache.set(key, { value, cachedAt: now });
        return withCacheState(value, request.refresh ? "refresh" : "miss");
    }

    async #compute(walletAddress: HexAddress, now: number): Promise<ComputedWalletValue> {
        const assets = await this.#assets.list();
        const quoteToken = findUsdQuoteToken(assets);
        const balances = await this.#readBalances(walletAddress, assets);
        const valuedAssets = await Promise.all(assets.map((asset) => this.#valueAsset({
            asset,
            balance: balances.get(asset.address.toLowerCase()) ?? 0n,
            quoteToken,
            walletAddress,
        })));
        const totalUsdBaseUnits = valuedAssets.reduce((total, asset) => asset.valueUsdBaseUnits === null ? total : total + BigInt(asset.valueUsdBaseUnits), 0n);
        const hasUnavailableValue = valuedAssets.some((asset) => asset.status === "unavailable");

        return {
            status: hasUnavailableValue ? "partial" : "complete",
            walletAddress,
            chainId: this.#balanceReader.chainId,
            quoteToken: {
                address: quoteToken.address,
                symbol: quoteToken.symbol,
                decimals: quoteToken.decimals,
            },
            totalUsd: formatBaseUnitDecimal(totalUsdBaseUnits, quoteToken.decimals),
            totalUsdBaseUnits: totalUsdBaseUnits.toString(),
            cachedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + this.#ttlMs).toISOString(),
            assets: valuedAssets,
        };
    }

    async #readBalances(walletAddress: HexAddress, assets: readonly TradableAsset[]): Promise<ReadonlyMap<string, bigint>> {
        const balances = new Map<string, bigint>();
        const nativeAsset = assets.find(isNativeAsset);
        if (nativeAsset) balances.set(nativeAsset.address.toLowerCase(), await this.#balanceReader.getNativeBalance(walletAddress));

        const tokenAssets = assets.filter((asset) => !isNativeAsset(asset));
        const tokenBalances = await this.#balanceReader.getTokenBalances(walletAddress, tokenAssets);
        for (const [address, balance] of tokenBalances) balances.set(address, balance);
        return balances;
    }

    async #valueAsset(input: {
        asset: TradableAsset;
        balance: bigint;
        quoteToken: TradableAsset;
        walletAddress: HexAddress;
    }): Promise<WalletValueAsset> {
        if (input.balance === 0n) {
            return {
                status: "empty",
                address: input.asset.address,
                symbol: input.asset.symbol,
                balance: "0",
                valueUsd: null,
                valueUsdBaseUnits: null,
            };
        }

        if (sameAddress(input.asset.address, input.quoteToken.address)) {
            return {
                status: "stable",
                address: input.asset.address,
                symbol: input.asset.symbol,
                balance: input.balance.toString(),
                valueUsd: formatBaseUnitDecimal(input.balance, input.quoteToken.decimals),
                valueUsdBaseUnits: input.balance.toString(),
            };
        }

        try {
            const quote = await this.#quoteProvider.quote(quoteRequest({
                asset: input.asset,
                amount: input.balance.toString(),
                quoteToken: input.quoteToken,
                walletAddress: input.walletAddress,
                chainId: this.#balanceReader.chainId,
            }));
            const quotedAmount = readQuoteOutputAmount(quote.quote) ?? readQuoteOutputAmount(quote.raw);
            if (!quotedAmount) throw new Error("quote response did not include output amount");

            const valueUsdBaseUnits = BigInt(quotedAmount);
            return {
                status: "quoted",
                address: input.asset.address,
                symbol: input.asset.symbol,
                balance: input.balance.toString(),
                valueUsd: formatBaseUnitDecimal(valueUsdBaseUnits, input.quoteToken.decimals),
                valueUsdBaseUnits: valueUsdBaseUnits.toString(),
            };
        } catch (err) {
            return {
                status: "unavailable",
                address: input.asset.address,
                symbol: input.asset.symbol,
                balance: input.balance.toString(),
                valueUsd: null,
                valueUsdBaseUnits: null,
                error: err instanceof Error ? err.message : "quote unavailable",
            };
        }
    }
}

export function createViemWalletValueBalanceReader(chainId: number, client: ViemBalanceClient): WalletValueBalanceReader {
    return {
        chainId,
        async getNativeBalance(walletAddress) {
            return await client.getBalance({ address: walletAddress });
        },
        async getTokenBalances(walletAddress, assets) {
            if (assets.length === 0) return new Map();

            let results: readonly unknown[];
            try {
                results = await client.multicall({
                    allowFailure: true,
                    contracts: assets.map((asset) => ({
                        address: asset.address,
                        abi: erc20Abi,
                        functionName: "balanceOf",
                        args: [walletAddress] as const,
                    })),
                });
            } catch {
                return await readTokenBalancesIndividually(client, walletAddress, assets);
            }

            const balances = new Map<string, bigint>();
            for (const [index, result] of results.entries()) {
                const asset = assets[index];
                if (!asset) continue;
                const balance = readMulticallBalance(result);
                balances.set(asset.address.toLowerCase(), balance.status === "success"
                    ? balance.value
                    : await readTokenBalance(client, walletAddress, asset));
            }
            return balances;
        },
    };
}

async function readTokenBalancesIndividually(client: ViemBalanceClient, walletAddress: HexAddress, assets: readonly TradableAsset[]): Promise<ReadonlyMap<string, bigint>> {
    const balances = new Map<string, bigint>();
    for (const asset of assets) {
        balances.set(asset.address.toLowerCase(), await readTokenBalance(client, walletAddress, asset));
    }
    return balances;
}

export function swapChain(chainId: number): Chain {
    if (chainId === base.id) return base;
    throw new Error(`unsupported swap asset chain ${chainId}`);
}

function findUsdQuoteToken(assets: readonly TradableAsset[]): TradableAsset {
    const quoteToken = assets.find((asset) => asset.symbol.toUpperCase() === USD_QUOTE_SYMBOL);
    if (!quoteToken) throw new Error(`swap assets must include ${USD_QUOTE_SYMBOL} to compute wallet dollar value`);
    return quoteToken;
}

function quoteRequest(input: {
    asset: TradableAsset;
    quoteToken: TradableAsset;
    amount: string;
    walletAddress: HexAddress;
    chainId: number;
}): SwapQuoteRequest {
    return {
        chainId: input.chainId,
        tokenIn: input.asset.address,
        tokenOut: input.quoteToken.address,
        amount: input.amount,
        swapper: input.walletAddress,
        type: "EXACT_INPUT",
        slippageTolerance: 0.5,
        permitAmount: "EXACT",
        routingPreference: "BEST_PRICE",
    };
}

function readQuoteOutputAmount(value: unknown): string | null {
    return readNestedString(value, ["output", "amount"]) ?? readNestedString(value, ["quote", "output", "amount"]);
}

function readNestedString(value: unknown, path: readonly string[]): string | null {
    let current = value;
    for (const segment of path) {
        if (!isRecord(current)) return null;
        current = current[segment];
    }
    return typeof current === "string" && /^[0-9]+$/.test(current) ? current : null;
}

async function readTokenBalance(client: ViemBalanceClient, walletAddress: HexAddress, asset: TradableAsset): Promise<bigint> {
    try {
        return await client.readContract({
            address: asset.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress],
        });
    } catch (err) {
        throw new Error(`unable to read ${asset.symbol} balance: ${err instanceof Error ? err.message : "unknown error"}`);
    }
}

function readMulticallBalance(value: unknown): { status: "success"; value: bigint } | { status: "failure" } {
    if (!isRecord(value)) return { status: "failure" };
    if (value.status !== "success") return { status: "failure" };
    return typeof value.result === "bigint" ? { status: "success", value: value.result } : { status: "failure" };
}

function formatBaseUnitDecimal(amount: bigint, decimals: number): string {
    if (decimals === 0) return amount.toString();

    const negative = amount < 0n;
    const absolute = negative ? -amount : amount;
    const padded = absolute.toString().padStart(decimals + 1, "0");
    const whole = padded.slice(0, -decimals);
    const fraction = padded.slice(-decimals).replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function withCacheState(value: ComputedWalletValue, cache: WalletValueCacheState): WalletValueResult {
    return { ...value, cache };
}

function cacheKey(chainId: number, walletAddress: HexAddress): string {
    return `${chainId}:${walletAddress.toLowerCase()}`;
}

function normalizeAddress(address: HexAddress): HexAddress {
    return address.toLowerCase() as HexAddress;
}

function sameAddress(left: string, right: string): boolean {
    return left.toLowerCase() === right.toLowerCase();
}

function isNativeAsset(asset: TradableAsset): boolean {
    return sameAddress(asset.address, NATIVE_TOKEN_ADDRESS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
