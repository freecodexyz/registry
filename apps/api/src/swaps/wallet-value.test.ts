import { describe, expect, it } from "vitest";
import type { TradableAsset } from "./assets";
import type { HexAddress, SwapQuoteRequest, SwapQuoteResult } from "./types";
import { createViemWalletValueBalanceReader, WalletValueService, type ViemBalanceClient, type WalletValueBalanceReader } from "./wallet-value";

const WALLET = "0x0000000000000000000000000000000000000001" as const;
const ETH = "0x0000000000000000000000000000000000000000" as const;
const WETH = "0x0000000000000000000000000000000000000002" as const;
const USDC = "0x0000000000000000000000000000000000000003" as const;
const FREECODE = "0x0000000000000000000000000000000000000004" as const;

describe("WalletValueService", () => {
    it("sums direct USDC balances and quoted non-USDC balances", async () => {
        const quoteCalls: SwapQuoteRequest[] = [];
        const service = new WalletValueService({
            assets: assetSource([asset("ETH", ETH, 18), asset("WETH", WETH, 18), asset("USDC", USDC, 6)]),
            balanceReader: balanceReader({
                native: 0n,
                tokens: new Map([
                    [WETH, 2_000_000_000_000_000_000n],
                    [USDC, 25_500_000n],
                ]),
            }),
            quoteProvider: {
                async quote(request) {
                    quoteCalls.push(request);
                    return quoteResult("3_000000");
                },
            },
            now: () => 1_000,
        });

        const result = await service.getWalletValue({ walletAddress: WALLET, refresh: false });

        expect(result.status).toBe("complete");
        expect(result.cache).toBe("miss");
        expect(result.totalUsd).toBe("28.5");
        expect(result.totalUsdBaseUnits).toBe("28500000");
        expect(quoteCalls).toHaveLength(1);
        expect(quoteCalls[0]).toMatchObject({
            tokenIn: WETH,
            tokenOut: USDC,
            amount: "2000000000000000000",
            swapper: WALLET,
            type: "EXACT_INPUT",
        });
    });

    it("returns cached wallet values until refresh is requested", async () => {
        let now = 10_000;
        let quoteCalls = 0;
        let balanceReads = 0;
        const service = new WalletValueService({
            assets: assetSource([asset("WETH", WETH, 18), asset("USDC", USDC, 6)]),
            balanceReader: {
                chainId: 8453,
                async getNativeBalance() {
                    return 0n;
                },
                async getTokenBalances() {
                    balanceReads += 1;
                    return new Map<string, bigint>([
                        [WETH.toLowerCase(), 1_000_000_000_000_000_000n],
                        [USDC.toLowerCase(), 1_000_000n],
                    ]);
                },
            },
            quoteProvider: {
                async quote() {
                    quoteCalls += 1;
                    return quoteResult("2_000000");
                },
            },
            ttlMs: 60_000,
            now: () => now,
        });

        const first = await service.getWalletValue({ walletAddress: WALLET, refresh: false });
        const second = await service.getWalletValue({ walletAddress: WALLET, refresh: false });
        now += 1;
        const refreshed = await service.getWalletValue({ walletAddress: WALLET, refresh: true });

        expect(first.cache).toBe("miss");
        expect(second.cache).toBe("hit");
        expect(refreshed.cache).toBe("refresh");
        expect(balanceReads).toBe(2);
        expect(quoteCalls).toBe(2);
    });

    it("keeps a partial total when a non-USDC quote is unavailable", async () => {
        const service = new WalletValueService({
            assets: assetSource([asset("FREECODE", FREECODE, 18), asset("USDC", USDC, 6)]),
            balanceReader: balanceReader({
                native: 0n,
                tokens: new Map([
                    [FREECODE, 1_000_000_000_000_000_000n],
                    [USDC, 7_250_000n],
                ]),
            }),
            quoteProvider: {
                async quote() {
                    throw new Error("No quotes available");
                },
            },
            now: () => 1_000,
        });

        const result = await service.getWalletValue({ walletAddress: WALLET, refresh: false });

        expect(result.status).toBe("partial");
        expect(result.totalUsd).toBe("7.25");
        expect(result.assets.find((value) => value.address === FREECODE)?.status).toBe("unavailable");
    });

    it("falls back to individual token reads when multicall omits ERC-20 balances", async () => {
        const individualReads: HexAddress[] = [];
        const reader = createViemWalletValueBalanceReader(8453, {
            async getBalance() {
                return 1_000_000_000_000_000_000n;
            },
            async multicall() {
                return [
                    { status: "failure", error: "rpc error" },
                    { status: "failure", error: "rpc error" },
                ];
            },
            async readContract(request) {
                individualReads.push(request.address);
                if (request.address === WETH) return 2_000_000_000_000_000_000n;
                if (request.address === USDC) return 4_000_000n;
                return 0n;
            },
        } satisfies ViemBalanceClient);
        const quoteCalls: SwapQuoteRequest[] = [];
        const service = new WalletValueService({
            assets: assetSource([asset("ETH", ETH, 18), asset("WETH", WETH, 18), asset("USDC", USDC, 6)]),
            balanceReader: reader,
            quoteProvider: {
                async quote(request) {
                    quoteCalls.push(request);
                    return quoteResult("3_000000");
                },
            },
            now: () => 1_000,
        });

        const result = await service.getWalletValue({ walletAddress: WALLET, refresh: false });

        expect(individualReads).toEqual([WETH, USDC]);
        expect(quoteCalls.map((call) => call.tokenIn)).toEqual([ETH, WETH]);
        expect(result.totalUsd).toBe("10");
        expect(result.assets.find((value) => value.address === WETH)?.balance).toBe("2000000000000000000");
        expect(result.assets.find((value) => value.address === USDC)?.balance).toBe("4000000");
    });
});

function asset(symbol: string, address: HexAddress, decimals: number): TradableAsset {
    return {
        chainId: 8453,
        address,
        symbol,
        name: symbol,
        decimals,
        source: "core",
        isConfigured: true,
    };
}

function assetSource(assets: readonly TradableAsset[]): { list(): Promise<TradableAsset[]> } {
    return {
        async list() {
            return [...assets];
        },
    };
}

function balanceReader(input: { native: bigint; tokens: ReadonlyMap<HexAddress, bigint> }): WalletValueBalanceReader {
    return {
        chainId: 8453,
        async getNativeBalance() {
            return input.native;
        },
        async getTokenBalances() {
            return new Map([...input.tokens].map(([address, balance]) => [address.toLowerCase(), balance]));
        },
    };
}

function quoteResult(amount: "2_000000" | "3_000000"): SwapQuoteResult {
    return {
        quote: { output: { amount: amount.replace("_", "") } },
        permitData: null,
        routing: "CLASSIC",
        raw: {},
    };
}
