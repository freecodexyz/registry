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
    imageUrl?: string;
    homepageUrl?: string;
    isSpam?: boolean;
    safetyLevel?: string | null;
    isConfigured: boolean;
    volume24HUsd?: number;
    repoId?: string;
    poolId?: HexAddress;
};

type AssetsLoaderOptions = {
    cwd: string;
    envPath?: string | undefined;
    fetcher?: AssetsFetch | undefined;
};

type AssetsFilePayload = {
    chainId?: number;
    assets: unknown[];
};

type LoadedAssets = {
    chainId: number;
    assets: TradableAsset[];
};

type AssetsFetch = (url: URL, init?: FetchRequest) => Promise<FetchResponse>;

type FetchRequest = Readonly<{
    method: "GET" | "POST";
    headers: Readonly<Record<string, string>>;
    body?: string;
}>;

type FetchResponse = Readonly<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
}>;

type UniswapProjectMetadata = {
    symbol?: string;
    name?: string;
    decimals?: number;
    imageUrl?: string;
    homepageUrl?: string;
    isSpam?: boolean;
    safetyLevel?: string | null;
    volume24HUsd?: number;
};

const BASE_CHAIN_ID = 8453;
const BASE_CHAIN = "BASE";
const UNISWAP_DEFAULT_TOKEN_LIST_URL = "https://tokens.uniswap.org/";
const UNISWAP_INTERFACE_GRAPHQL_URL = "https://interface.gateway.uniswap.org/v1/graphql";
const HYDRATE_TOKENS_QUERY = `
query HydrateTokens($contracts: [ContractInput!]!) {
  tokens(contracts: $contracts) {
    address
    chain
    decimals
    name
    symbol
    market(currency: USD) {
      volume24H: volume(duration: DAY) {
        value
      }
    }
    project {
      logoUrl
      homepageUrl
      isSpam
      safetyLevel
    }
  }
}
`;

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
        const localAssets = parseAssetsFile(await readJson(filePath));
        const fetcher = options.fetcher ?? (fetch as unknown as AssetsFetch);
        const payload = await mergeAssets(localAssets, fetcher);
        return new AssetsLoader(filePath, payload);
    }

    async list(): Promise<TradableAsset[]> {
        return [...this.#assets];
    }

    async isTradable(address: HexAddress): Promise<boolean> {
        return this.#tradableAddresses.has(address.toLowerCase());
    }
}

async function mergeAssets(loaded: LoadedAssets, fetcher: AssetsFetch): Promise<LoadedAssets> {
    if (loaded.chainId !== BASE_CHAIN_ID) return loaded;

    const configuredAddresses = new Set(loaded.assets.map((asset) => asset.address.toLowerCase()));
    const uniswapAssets = (await fetchUniswapDefaultBaseAssets(fetcher)).map((asset) => ({
        ...asset,
        isConfigured: configuredAddresses.has(asset.address.toLowerCase()),
    }));
    const uniswapAddresses = new Set(uniswapAssets.map((asset) => asset.address.toLowerCase()));
    const localOnlyAssets = loaded.assets.filter((asset) => !uniswapAddresses.has(asset.address.toLowerCase()));
    const assets = await hydrateAssets([...uniswapAssets, ...localOnlyAssets], fetcher);
    ensureUniqueAssets(assets);
    return { chainId: loaded.chainId, assets };
}

async function fetchUniswapDefaultBaseAssets(fetcher: AssetsFetch): Promise<TradableAsset[]> {
    const payload = await requestJson(fetcher, new URL(UNISWAP_DEFAULT_TOKEN_LIST_URL), {
        method: "GET",
        headers: { "accept": "application/json" },
    }, "Uniswap default token list");
    const assets = parseUniswapDefaultTokenList(payload);
    if (assets.length === 0) throw new Error("Uniswap default token list did not contain Base assets");
    ensureUniqueAssets(assets);
    return assets;
}

async function hydrateAssets(assets: readonly TradableAsset[], fetcher: AssetsFetch): Promise<TradableAsset[]> {
    if (assets.length === 0) return [];

    let payload: unknown;
    try {
        payload = await requestJson(fetcher, new URL(UNISWAP_INTERFACE_GRAPHQL_URL), {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "origin": "https://app.uniswap.org",
            },
            body: JSON.stringify({
                operationName: "HydrateTokens",
                query: HYDRATE_TOKENS_QUERY,
                variables: {
                    contracts: assets.map((asset) => ({
                        chain: BASE_CHAIN,
                        address: asset.address,
                    })),
                },
            }),
        }, "Uniswap token metadata");
    } catch {
        return [...assets];
    }

    let hydrated: ReadonlyMap<string, UniswapProjectMetadata>;
    try {
        hydrated = parseUniswapTokenMetadata(payload);
    } catch {
        return [...assets];
    }

    if (hydrated.size === 0) return [...assets];

    return assets.map((asset) => {
        const metadata = hydrated.get(asset.address.toLowerCase());
        if (!metadata) return asset;

        return {
            ...asset,
            ...metadata,
        };
    });
}

async function requestJson(fetcher: AssetsFetch, url: URL, init: FetchRequest, name: string): Promise<unknown> {
    const response = await fetcher(url, init);
    const text = await response.text();
    if (!response.ok) throw new Error(`${name} request failed with HTTP ${response.status}`);

    try {
        return JSON.parse(text) as unknown;
    } catch (err) {
        throw new Error(`${name} response was not valid JSON: ${errorMessage(err)}`);
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
        isConfigured: true,
    };

    if (record.repoId !== undefined) asset.repoId = readNonEmptyString(record.repoId, `asset[${index}].repoId`);
    if (record.poolId !== undefined) asset.poolId = readAddress(record.poolId, `asset[${index}].poolId`);
    if (record.imageUrl !== undefined) asset.imageUrl = readNonEmptyString(record.imageUrl, `asset[${index}].imageUrl`);
    if (record.homepageUrl !== undefined) asset.homepageUrl = readNonEmptyString(record.homepageUrl, `asset[${index}].homepageUrl`);
    if (record.isSpam !== undefined) asset.isSpam = readBoolean(record.isSpam, `asset[${index}].isSpam`);
    if (record.safetyLevel !== undefined) asset.safetyLevel = readNullableString(record.safetyLevel, `asset[${index}].safetyLevel`);
    return asset;
}

function parseUniswapDefaultTokenList(value: unknown): TradableAsset[] {
    const record = readRecord(value, "Uniswap default token list");
    if (!Array.isArray(record.tokens)) throw new Error("Uniswap default token list must contain a tokens array");

    return record.tokens
        .map((token, index) => parseUniswapTokenListAsset(token, index))
        .filter((asset): asset is TradableAsset => asset !== null);
}

function parseUniswapTokenListAsset(value: unknown, index: number): TradableAsset | null {
    const record = readRecord(value, `Uniswap token[${index}]`);
    const chainId = readChainId(record.chainId, `Uniswap token[${index}].chainId`);
    if (chainId !== BASE_CHAIN_ID) return null;

    const asset: TradableAsset = {
        chainId,
        address: readAddress(record.address, `Uniswap token[${index}].address`),
        symbol: readNonEmptyString(record.symbol, `Uniswap token[${index}].symbol`),
        name: readNonEmptyString(record.name, `Uniswap token[${index}].name`),
        decimals: readDecimals(record.decimals, `Uniswap token[${index}].decimals`),
        source: "core",
        isConfigured: false,
    };

    if (record.logoURI !== undefined && record.logoURI !== "") {
        asset.imageUrl = readNonEmptyString(record.logoURI, `Uniswap token[${index}].logoURI`);
    }

    return asset;
}

function parseUniswapTokenMetadata(value: unknown): ReadonlyMap<string, UniswapProjectMetadata> {
    const response = readRecord(value, "Uniswap token metadata response");
    const data = readRecord(response.data, "Uniswap token metadata response.data");
    if (!Array.isArray(data.tokens)) return new Map();

    const metadata = new Map<string, UniswapProjectMetadata>();
    for (const [index, token] of data.tokens.entries()) {
        const parsed = parseUniswapMetadataToken(token, index);
        if (!parsed) continue;
        metadata.set(parsed.address.toLowerCase(), parsed.metadata);
    }

    return metadata;
}

function parseUniswapMetadataToken(value: unknown, index: number): { address: HexAddress; metadata: UniswapProjectMetadata } | null {
    if (value === null) return null;

    const record = readRecord(value, `Uniswap metadata token[${index}]`);
    if (readNonEmptyString(record.chain, `Uniswap metadata token[${index}].chain`) !== BASE_CHAIN) return null;

    const metadata: UniswapProjectMetadata = {
        name: readNonEmptyString(record.name, `Uniswap metadata token[${index}].name`),
        symbol: readNonEmptyString(record.symbol, `Uniswap metadata token[${index}].symbol`),
        decimals: readDecimals(record.decimals, `Uniswap metadata token[${index}].decimals`),
    };

    const project = record.project === null || record.project === undefined
        ? null
        : readRecord(record.project, `Uniswap metadata token[${index}].project`);
    const market = record.market === null || record.market === undefined
        ? null
        : readRecord(record.market, `Uniswap metadata token[${index}].market`);

    if (market) {
        const volume = market.volume24H === null || market.volume24H === undefined
            ? null
            : readRecord(market.volume24H, `Uniswap metadata token[${index}].market.volume24H`);
        const volume24HUsd = volume ? readOptionalNumber(volume.value, `Uniswap metadata token[${index}].market.volume24H.value`) : undefined;
        if (volume24HUsd !== undefined) metadata.volume24HUsd = volume24HUsd;
    }

    if (project) {
        if (typeof project.logoUrl === "string" && project.logoUrl.trim() !== "") metadata.imageUrl = project.logoUrl;
        if (typeof project.homepageUrl === "string" && project.homepageUrl.trim() !== "") metadata.homepageUrl = project.homepageUrl;
        if (project.isSpam !== undefined && project.isSpam !== null) metadata.isSpam = readBoolean(project.isSpam, `Uniswap metadata token[${index}].project.isSpam`);
        if (project.safetyLevel !== undefined) metadata.safetyLevel = readNullableString(project.safetyLevel, `Uniswap metadata token[${index}].project.safetyLevel`);
    }

    return {
        address: readAddress(record.address, `Uniswap metadata token[${index}].address`),
        metadata,
    };
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

function readBoolean(value: unknown, name: string): boolean {
    if (typeof value !== "boolean") throw new Error(`${name} must be a boolean`);
    return value;
}

function readNullableString(value: unknown, name: string): string | null {
    if (value === null) return null;
    if (typeof value !== "string") throw new Error(`${name} must be a string or null`);
    return value;
}

function readOptionalNumber(value: unknown, name: string): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
    return value;
}

function readSource(value: unknown, name: string): TradableAsset["source"] {
    if (value === "core" || value === "market") return value;
    throw new Error(`${name} must be core or market`);
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}
