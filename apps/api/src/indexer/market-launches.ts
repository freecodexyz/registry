import { decodeEventLog, parseAbiItem, type Address, type Hash, type Hex } from "viem";
import { db, insertMarket } from "../db/db";
import type { client, MarketLaunchedEvent } from "../index";
import type { BlockRange, IndexerStep } from "./engine";
import type { LogsFetcher } from "./fetch-logs";

const AirlockCreateEvent = parseAbiItem("event Create(address asset, address indexed numeraire, address initializer, address poolOrHook)");
const PoolManagerInitializeEvent = parseAbiItem("event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)");

type MarketLaunchReceiptClient = Pick<typeof client, "getTransactionReceipt">;

type MarketLaunchLog = {
    args: {
        repoId: bigint;
        asset: Address;
        launcher: Address;
    };
    blockNumber: bigint;
    transactionHash: Hash | null;
};

type ParsedMarketLaunch = ParseHookResult & {
    log: MarketLaunchLog;
};

type ParseHookResult = {
    hook: Address;
    poolId: Hex;
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
};

type AirlockCreateDecoded = { args: { poolOrHook: Address } };
type PoolManagerInitializeDecoded = {
    args: {
        id: Hex;
        currency0: Address;
        currency1: Address;
        fee: number;
        tickSpacing: number;
        hooks: Address;
    };
};

export type MarketLaunchIndexerOptions = {
    address: Address | undefined;
    event: typeof MarketLaunchedEvent;
    logsFetcher: LogsFetcher;
    receiptClient: MarketLaunchReceiptClient;
};

export class MarketLaunchIndexer implements IndexerStep {
    readonly name = "market-launches";

    private readonly address: Address;
    private readonly event: typeof MarketLaunchedEvent;
    private readonly logsFetcher: LogsFetcher;
    private readonly receiptClient: MarketLaunchReceiptClient;

    constructor(options: MarketLaunchIndexerOptions) {
        if (!options.address) throw new Error("Launcher address missing");

        this.address = options.address;
        this.event = options.event;
        this.logsFetcher = options.logsFetcher;
        this.receiptClient = options.receiptClient;
    }

    async index(range: BlockRange): Promise<void> {
        const launchLogs = await this.fetch(range);
        // Receipt reads stay outside the SQLite transaction so parse failures cannot leave partial market writes.
        const launchesParsed = await Promise.all(launchLogs.map(async (log) => ({
            log,
            ...(await this.parseHookFromTx(log.transactionHash)),
        })));

        this.insert(launchesParsed);
    }

    private async fetch(range: BlockRange): Promise<MarketLaunchLog[]> {
        const logs = await this.logsFetcher.getLogs({
            address: this.address,
            event: this.event,
            fromBlock: range.fromBlock,
            toBlock: range.toBlock,
        });

        return logs.map((log) => ({
            args: {
                repoId: log.args.repoId,
                asset: log.args.asset,
                launcher: log.args.launcher,
            },
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash ?? null,
        }));
    }

    private insert(rows: readonly ParsedMarketLaunch[]): void {
        const launchTx = db.transaction((launches: readonly ParsedMarketLaunch[]) => {
            for (const { log: l, hook, poolId, currency0, currency1, fee, tickSpacing } of launches) {
                insertMarket.run(
                    String(l.args.repoId), l.args.asset, hook, poolId,
                    currency0, currency1, fee, tickSpacing,
                    Number(l.blockNumber), l.args.launcher,
                );
            }
        });

        launchTx(rows);
    }

    private async parseHookFromTx(tx: Hash | null): Promise<ParseHookResult> {
        if (!tx) throw new Error("market launch log is missing transaction hash");

        const receipt = await this.receiptClient.getTransactionReceipt({ hash: tx });
        let hook: Address | undefined;
        let pool: Omit<ParseHookResult, "hook"> | undefined;

        for (const log of receipt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: [AirlockCreateEvent],
                    data: log.data,
                    topics: log.topics,
                }) as AirlockCreateDecoded;
                hook = decoded.args.poolOrHook;
            } catch {}

            try {
                const decoded = decodeEventLog({
                    abi: [PoolManagerInitializeEvent],
                    data: log.data,
                    topics: log.topics,
                }) as PoolManagerInitializeDecoded;
                pool = {
                    poolId: decoded.args.id,
                    currency0: decoded.args.currency0,
                    currency1: decoded.args.currency1,
                    fee: decoded.args.fee,
                    tickSpacing: decoded.args.tickSpacing,
                };
            } catch {}

            if (hook && pool) return { hook, ...pool };
        }

        throw new Error(`missing Airlock Create or PoolManager Initialize event in tx ${tx}`);
    }
}
