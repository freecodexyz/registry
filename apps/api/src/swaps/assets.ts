import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { isAddress } from "viem";
import type { HexAddress } from "./types";

export type TradableAsset = {
    chainId: number;
    address: HexAddress;
    symbol: string;
    name: string;
    decimals: number;
    source: "core" | "market";
    repoId?: string;
    poolId?: HexAddress;
};

type AssetsLoaderOptions = {
    cwd: string;
    envPath?: string | undefined;
};

type AssetsFilePayload = {
    chainId?: number;
    assets: unknown[];
};

type LoadedAssets = {
    chainId: number;
    assets: TradableAsset[];
};

export class AssetsLoader {
    readonly filePath: string;
    readonly chainId: number;
    readonly #assets: readonly TradableAsset[];
    readonly #tradableAddresses: ReadonlySet<string>;

    private constructor(filePath: string, loaded: LoadedAssets) {
        this.filePath = filePath;
        this.chainId = loaded.chainId;
        this.#assets = loaded.assets;
        this.#tradableAddresses = new Set(loaded.assets.map((asset) => asset.address.toLowerCase()));
    }

    static async load(options: AssetsLoaderOptions): Promise<AssetsLoader> {
        const filePath = await resolveAssetsFile(options);
        const payload = parseAssetsFile(await readJson(filePath));
        return new AssetsLoader(filePath, payload);
    }

    async list(): Promise<TradableAsset[]> {
        return [...this.#assets];
    }

    async isTradable(address: HexAddress): Promise<boolean> {
        return this.#tradableAddresses.has(address.toLowerCase());
    }
}

async function resolveAssetsFile(options: AssetsLoaderOptions): Promise<string> {
    const configuredPath = options.envPath?.trim();
    if (configuredPath) return isAbsolute(configuredPath) ? configuredPath : resolve(options.cwd, configuredPath);

    const entries = await readdir(options.cwd, { withFileTypes: true });
    const candidates = await Promise.all(entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".assets.json"))
        .map(async (entry) => {
            const filePath = resolve(options.cwd, entry.name);
            return { filePath, modifiedAt: (await stat(filePath)).mtimeMs };
        }));

    candidates.sort((a, b) => b.modifiedAt - a.modifiedAt || a.filePath.localeCompare(b.filePath));
    const file = candidates[0]?.filePath;
    if (!file) throw new Error(`no *.assets.json file found in ${options.cwd}; set SWAP_ASSETS_FILE_PATH to configure one`);
    return file;
}

async function readJson(filePath: string): Promise<unknown> {
    let text: string;
    try {
        text = await readFile(filePath, "utf8");
    } catch (err) {
        throw new Error(`unable to read swap assets file ${filePath}: ${errorMessage(err)}`);
    }

    try {
        return JSON.parse(text) as unknown;
    } catch (err) {
        throw new Error(`unable to parse swap assets file ${filePath}: ${errorMessage(err)}`);
    }
}

function parseAssetsFile(value: unknown): LoadedAssets {
    const payload = readPayload(value);
    const assets = payload.assets.map((asset, index) => parseAsset(asset, payload.chainId, index));
    if (assets.length === 0) throw new Error("swap assets file must contain at least one asset");
    ensureUniqueAssets(assets);
    const chainId = readAssetsChainId(payload.chainId, assets);
    return { chainId, assets };
}

function readPayload(value: unknown): AssetsFilePayload {
    if (Array.isArray(value)) return { assets: value };
    const record = readRecord(value, "swap assets file");
    if (!Array.isArray(record.assets)) throw new Error("swap assets file must contain an assets array");

    const payload: AssetsFilePayload = { assets: record.assets };
    if (record.chainId !== undefined) payload.chainId = readChainId(record.chainId, "chainId");
    return payload;
}

function parseAsset(value: unknown, fileChainId: number | undefined, index: number): TradableAsset {
    const record = readRecord(value, `asset[${index}]`);
    const chainId = record.chainId === undefined ? fileChainId : readChainId(record.chainId, `asset[${index}].chainId`);
    if (chainId === undefined) throw new Error(`asset[${index}].chainId is required when file chainId is not set`);
    if (fileChainId !== undefined && chainId !== fileChainId) throw new Error(`asset[${index}].chainId must be ${fileChainId}`);

    const asset: TradableAsset = {
        chainId,
        address: readAddress(record.address, `asset[${index}].address`),
        symbol: readNonEmptyString(record.symbol, `asset[${index}].symbol`),
        name: readNonEmptyString(record.name, `asset[${index}].name`),
        decimals: readDecimals(record.decimals, `asset[${index}].decimals`),
        source: readSource(record.source, `asset[${index}].source`),
    };

    if (record.repoId !== undefined) asset.repoId = readNonEmptyString(record.repoId, `asset[${index}].repoId`);
    if (record.poolId !== undefined) asset.poolId = readAddress(record.poolId, `asset[${index}].poolId`);
    return asset;
}

function readAssetsChainId(fileChainId: number | undefined, assets: readonly TradableAsset[]): number {
    if (fileChainId !== undefined) return fileChainId;

    const chainIds = new Set(assets.map((asset) => asset.chainId));
    if (chainIds.size !== 1) throw new Error("swap assets file must contain assets for one chain");
    const chainId = assets[0]?.chainId;
    if (chainId === undefined) throw new Error("swap assets file must contain at least one asset");
    return chainId;
}

function ensureUniqueAssets(assets: readonly TradableAsset[]): void {
    const seen = new Set<string>();
    for (const asset of assets) {
        const key = asset.address.toLowerCase();
        if (seen.has(key)) throw new Error(`duplicate asset address ${asset.address}`);
        seen.add(key);
    }
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
    return value as Record<string, unknown>;
}

function readAddress(value: unknown, name: string): HexAddress {
    if (typeof value !== "string" || !isAddress(value)) throw new Error(`${name} must be a valid address`);
    return value as HexAddress;
}

function readNonEmptyString(value: unknown, name: string): string {
    if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} must be a non-empty string`);
    return value;
}

function readChainId(value: unknown, name: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
    return value;
}

function readDecimals(value: unknown, name: string): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 255) throw new Error(`${name} must be an integer between 0 and 255`);
    return value;
}

function readSource(value: unknown, name: string): TradableAsset["source"] {
    if (value === "core" || value === "market") return value;
    throw new Error(`${name} must be core or market`);
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
