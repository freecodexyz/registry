import type Database from "better-sqlite3";
import { erc20Abi, isAddress } from "viem";
import type { HexAddress } from "./types";
import { NATIVE_TOKEN_ADDRESS } from "./types";

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

type MarketAssetRow = {
    repo_id: string;
    asset: string;
    pool_id: string;
    full_name: string | null;
};

type AssetMetadata = {
    symbol: string;
    name: string;
    decimals: number;
};

type ContractReader = {
    readContract(args: { address: HexAddress; abi: typeof erc20Abi; functionName: "symbol" | "name" | "decimals" }): Promise<unknown>;
};

const BASE_SEPOLIA_CORE_ASSETS: Omit<TradableAsset, "chainId">[] = [
    {
        address: NATIVE_TOKEN_ADDRESS,
        symbol: "ETH",
        name: "Ether",
        decimals: 18,
        source: "core",
    },
    {
        address: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        source: "core",
    },
    {
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        source: "core",
    },
];

export class TradableAssetRegistry {
    private readonly metadataCache = new Map<string, AssetMetadata>();

    constructor(
        private readonly db: Database.Database,
        private readonly client: ContractReader,
        private readonly chainId: number,
    ) {}

    async list(): Promise<TradableAsset[]> {
        const coreAssets = BASE_SEPOLIA_CORE_ASSETS.map((asset) => ({ ...asset, chainId: this.chainId }));
        const rows = this.db.prepare(`
            SELECT mk.repo_id, mk.asset, mk.pool_id, meta.full_name
            FROM markets mk
            LEFT JOIN github_meta meta ON meta.repo_id = mk.repo_id
            WHERE mk.asset IS NOT NULL
            ORDER BY mk.launched_at DESC, mk.repo_id DESC
        `).all() as MarketAssetRow[];

        const marketAssets = await Promise.all(rows.map((row) => this.assetFromMarket(row)));
        const byAddress = new Map<string, TradableAsset>();
        for (const asset of [...coreAssets, ...marketAssets]) byAddress.set(asset.address.toLowerCase(), asset);

        return [...byAddress.values()];
    }

    async isTradable(address: HexAddress): Promise<boolean> {
        if (address.toLowerCase() === NATIVE_TOKEN_ADDRESS) return true;
        return (await this.list()).some((asset) => asset.address.toLowerCase() === address.toLowerCase());
    }

    private async assetFromMarket(row: MarketAssetRow): Promise<TradableAsset> {
        const address = isAddress(row.asset) ? row.asset as HexAddress : NATIVE_TOKEN_ADDRESS;
        const metadata = await this.readMetadata(address, row);
        const asset: TradableAsset = {
            chainId: this.chainId,
            address,
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            source: "market",
            repoId: row.repo_id,
        };
        if (isAddress(row.pool_id)) asset.poolId = row.pool_id as HexAddress;
        return asset;
    }

    private async readMetadata(address: HexAddress, row: MarketAssetRow): Promise<AssetMetadata> {
        const key = address.toLowerCase();
        const cached = this.metadataCache.get(key);
        if (cached) return cached;

        const fallbackSymbol = symbolFromMarket(row);
        const fallbackName = row.full_name ?? `RIK ${row.repo_id}`;
        let symbol = fallbackSymbol;
        let name = fallbackName;
        let decimals = 18;

        if (address !== NATIVE_TOKEN_ADDRESS) {
            const [symbolResult, nameResult, decimalsResult] = await Promise.allSettled([
                this.client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
                this.client.readContract({ address, abi: erc20Abi, functionName: "name" }),
                this.client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
            ]);

            if (symbolResult.status === "fulfilled" && typeof symbolResult.value === "string" && symbolResult.value) symbol = symbolResult.value;
            if (nameResult.status === "fulfilled" && typeof nameResult.value === "string" && nameResult.value) name = nameResult.value;
            if (decimalsResult.status === "fulfilled" && typeof decimalsResult.value === "number") decimals = decimalsResult.value;
        }

        const metadata = { symbol, name, decimals };
        this.metadataCache.set(key, metadata);
        return metadata;
    }
}

function symbolFromMarket(row: Pick<MarketAssetRow, "full_name" | "repo_id">): string {
    const fullName = row.full_name?.trim();
    if (!fullName) return `RIK-${row.repo_id}`;

    return fullName.split("/").at(-1)?.slice(0, 16).toUpperCase() || `RIK-${row.repo_id}`;
}
