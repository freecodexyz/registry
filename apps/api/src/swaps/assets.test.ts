import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { AssetsLoader } from "./assets";

const CHAIN_ID = 84532;
const ETH = "0x0000000000000000000000000000000000000000" as const;
const WETH = "0x4200000000000000000000000000000000000006" as const;
const TOKEN = "0x0000000000000000000000000000000000000001" as const;

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
});

async function tempDir(): Promise<string> {
    return await mkdtemp(join(tmpdir(), "registry-assets-"));
}

async function writeAssets(filePath: string, assets: readonly unknown[]): Promise<void> {
    await writeFile(filePath, JSON.stringify({ chainId: CHAIN_ID, assets }));
}

function asset(symbol: string, address: string): { chainId: number; address: string; symbol: string; name: string; decimals: number; source: "core" } {
    return {
        chainId: CHAIN_ID,
        address,
        symbol,
        name: symbol,
        decimals: 18,
        source: "core",
    };
}

async function waitForDifferentMtime(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
}
