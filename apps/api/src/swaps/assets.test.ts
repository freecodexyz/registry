import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AssetsLoader } from "./assets";

const CHAIN_ID = 84532;
const BASE_CHAIN_ID = 8453;
const ETH = "0x0000000000000000000000000000000000000000" as const;
const WETH = "0x4200000000000000000000000000000000000006" as const;
const TOKEN = "0x0000000000000000000000000000000000000001" as const;
const FREECODE = "0x67A7CA081Dc79B45fD1FA059Cd3b8dCcA779Aba3" as const;

describe("AssetsLoader", () => {
    it("loads assets from an explicit file path", async () => {
        const cwd = await tempDir();
        const filePath = join(cwd, "configured.assets.json");
        await writeAssets(filePath, [asset("ETH", ETH), asset("WETH", WETH)]);

        const loader = await AssetsLoader.load({ cwd, envPath: filePath });

        expect(loader.chainId).toBe(CHAIN_ID);
        await expect(loader.list()).resolves.toEqual([asset("ETH", ETH), asset("WETH", WETH)]);
        await expect(loader.isTradable(ETH)).resolves.toBe(true);
        await expect(loader.isTradable(TOKEN)).resolves.toBe(false);
    });

    it("discovers the newest assets file in the command working directory", async () => {
        const cwd = await tempDir();
        await writeAssets(join(cwd, "old.assets.json"), [asset("ETH", ETH)]);
        await waitForDifferentMtime();
        const newestPath = join(cwd, "new.assets.json");
        await writeAssets(newestPath, [asset("WETH", WETH)]);

        const loader = await AssetsLoader.load({ cwd });

        expect(loader.filePath).toBe(newestPath);
        await expect(loader.list()).resolves.toEqual([asset("WETH", WETH)]);
    });

    it("rejects malformed asset addresses instead of loading them", async () => {
        const cwd = await tempDir();
        const filePath = join(cwd, "bad.assets.json");
        await writeFile(filePath, JSON.stringify({
            chainId: CHAIN_ID,
            assets: [{ ...asset("USDC", "0x036CbD53842c5426634e7929541eC2318f3dCF7"), decimals: 6 }],
        }));

        await expect(AssetsLoader.load({ cwd, envPath: filePath })).rejects.toThrow("asset[0].address must be a valid address");
    });

    it("requires an assets file when no explicit path is configured", async () => {
        const cwd = await tempDir();

        await expect(AssetsLoader.load({ cwd })).rejects.toThrow("no *.assets.json file found");
    });

    it("loads Base defaults from Uniswap and ignores duplicate configured assets", async () => {
        const cwd = await tempDir();
        const filePath = join(cwd, "base.assets.json");
        await writeBaseAssets(filePath, [
            { ...baseAsset("LOCAL_WETH", WETH), name: "Local Wrapped Ether" },
            baseAsset("FREECODE", FREECODE),
        ]);

        const fetcher = mockFetch({
            tokenList: {
                tokens: [
                    {
                        chainId: BASE_CHAIN_ID,
                        address: WETH,
                        symbol: "WETH",
                        name: "Wrapped Ether",
                        decimals: 18,
                        logoURI: "https://assets.example/weth.png",
                    },
                    {
                        chainId: 1,
                        address: TOKEN,
                        symbol: "IGNORED",
                        name: "Ignored",
                        decimals: 18,
                    },
                ],
            },
            metadata: {
                data: {
                    tokens: [
                        {
                            address: FREECODE,
                            chain: "BASE",
                            decimals: 18,
                            name: "FreeCode",
                            symbol: "FreeCode",
                            market: {
                                volume24H: {
                                    value: 12345.67,
                                },
                            },
                            project: {
                                logoUrl: "https://assets.example/freecode.png",
                                homepageUrl: "https://freecodefund.xyz",
                                isSpam: true,
                                safetyLevel: null,
                            },
                        },
                    ],
                },
            },
        });

        const loader = await AssetsLoader.load({ cwd, envPath: filePath, fetcher });

        await expect(loader.list()).resolves.toEqual([
            {
                chainId: BASE_CHAIN_ID,
                address: WETH,
                symbol: "WETH",
                name: "Wrapped Ether",
                decimals: 18,
                source: "core",
                isConfigured: true,
                imageUrl: "https://assets.example/weth.png",
            },
            {
                chainId: BASE_CHAIN_ID,
                address: FREECODE,
                symbol: "FreeCode",
                name: "FreeCode",
                decimals: 18,
                source: "core",
                isConfigured: true,
                imageUrl: "https://assets.example/freecode.png",
                homepageUrl: "https://freecodefund.xyz",
                isSpam: true,
                safetyLevel: null,
                volume24HUsd: 12345.67,
            },
        ]);
    });

    it("keeps configured metadata when GraphQL hydration fails", async () => {
        const cwd = await tempDir();
        const filePath = join(cwd, "base.assets.json");
        await writeBaseAssets(filePath, [baseAsset("FREECODE", FREECODE)]);

        const loader = await AssetsLoader.load({
            cwd,
            envPath: filePath,
            fetcher: mockFetch({
                tokenList: {
                    tokens: [{
                        chainId: BASE_CHAIN_ID,
                        address: WETH,
                        symbol: "WETH",
                        name: "Wrapped Ether",
                        decimals: 18,
                    }],
                },
                metadata: { errors: [{ message: "unavailable" }] },
            }),
        });

        await expect(loader.list()).resolves.toEqual([
            {
                chainId: BASE_CHAIN_ID,
                address: WETH,
                symbol: "WETH",
                name: "Wrapped Ether",
                decimals: 18,
                source: "core",
                isConfigured: false,
            },
            baseAsset("FREECODE", FREECODE),
        ]);
    });
});

async function tempDir(): Promise<string> {
    return await mkdtemp(join(tmpdir(), "registry-assets-"));
}

async function writeAssets(filePath: string, assets: readonly unknown[]): Promise<void> {
    await writeFile(filePath, JSON.stringify({ chainId: CHAIN_ID, assets }));
}

async function writeBaseAssets(filePath: string, assets: readonly unknown[]): Promise<void> {
    await writeFile(filePath, JSON.stringify({ chainId: BASE_CHAIN_ID, assets }));
}

function asset(symbol: string, address: string): { chainId: number; address: string; symbol: string; name: string; decimals: number; source: "core"; isConfigured: true } {
    return {
        chainId: CHAIN_ID,
        address,
        symbol,
        name: symbol,
        decimals: 18,
        source: "core",
        isConfigured: true,
    };
}

function baseAsset(symbol: string, address: string): { chainId: number; address: string; symbol: string; name: string; decimals: number; source: "core"; isConfigured: true } {
    return {
        chainId: BASE_CHAIN_ID,
        address,
        symbol,
        name: symbol,
        decimals: 18,
        source: "core",
        isConfigured: true,
    };
}

function mockFetch(responses: { tokenList: unknown; metadata: unknown }) {
    return async (url: URL): Promise<{ ok: boolean; status: number; text(): Promise<string> }> => {
        const payload = url.hostname === "tokens.uniswap.org" ? responses.tokenList : responses.metadata;
        return {
            ok: true,
            status: 200,
            async text() {
                return JSON.stringify(payload);
            },
        };
    };
}

async function waitForDifferentMtime(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
}
