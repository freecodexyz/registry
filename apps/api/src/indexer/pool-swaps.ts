import type { Address, Hash, Hex } from "viem";
import { db, insertTrade } from "../db/db";
import type { client, SwapEvent } from "../index";
import type { EventMessage } from "../shared/events-socket";
import type { BlockRange, IndexerStep } from "./engine";
import type { LogsFetcher } from "./fetch-logs";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
const INTERVAL_SECS = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14_400,
    "1d": 86_400,
} as const;
const SQRT_TO_PRICE_SQL = `
POW(CAST(sqrtPriceX96 AS REAL) / POW(2.0, 96), 2)
`;

type PoolSwapBlockClient = Pick<typeof client, "getBlock">;

type KnownPoolRow = {
    pool_id: string;
    repo_id: string;
};

type PoolSwapLog = {
    args: {
        id: Hex;
        sender: Address;
        amount0: bigint;
        amount1: bigint;
        sqrtPriceX96: bigint;
    };
    blockNumber: bigint;
    transactionHash: Hash;
    logIndex: number;
};

type TradePayload = {
    txHash: Hash;
    logIndex: number;
    poolId: Hex;
    repoId: string;
    sender: Address;
    amount0: string;
    amount1: string;
    sqrtPriceX96: string;
    blockNumber: number;
    ts: number;
};

type CandlePayload = {
    time: number;
    low: number | null;
    high: number | null;
    open: number | null;
    close: number | null;
    volume: number | null;
};

type PoolSwapPublisher = (message: EventMessage) => void;

export type PoolSwapIndexerOptions = {
    address: Address | undefined;
    event: typeof SwapEvent;
    logsFetcher: LogsFetcher;
    blockClient: PoolSwapBlockClient;
    publishEventMessage: PoolSwapPublisher;
};

export class PoolSwapIndexer implements IndexerStep {
    readonly name = "pool-swaps";

    private readonly address: Address;
    private readonly event: typeof SwapEvent;
    private readonly logsFetcher: LogsFetcher;
    private readonly blockClient: PoolSwapBlockClient;
    private readonly publishEventMessage: PoolSwapPublisher;
    private readonly blockTimestampCache = new Map<bigint, number>();

    constructor(options: PoolSwapIndexerOptions) {
        if (!options.address) throw new Error("V4 Pool Manager address is missing");

        this.address = options.address;
        this.event = options.event;
        this.logsFetcher = options.logsFetcher;
        this.blockClient = options.blockClient;
        this.publishEventMessage = options.publishEventMessage;
    }

    async index(range: BlockRange): Promise<void> {
        const knownPools = this.loadKnownPools();
        if (knownPools.size === 0) return;

        const swaps = await this.fetch(range, knownPools);
        await Promise.all(swaps.map((log) => this.cacheBlockTimestamp(log.blockNumber)));

        const insertedTrades = this.insert(swaps, knownPools);
        for (const tradePayload of insertedTrades) this.emitLiveTrade(tradePayload);
    }

    private loadKnownPools(): Map<Hex, string> {
        const rows = db.prepare("SELECT pool_id, repo_id FROM markets").all() as KnownPoolRow[];
        return new Map(rows.map((row) => [row.pool_id.toLowerCase() as Hex, row.repo_id]));
    }

    private async fetch(range: BlockRange, knownPools: ReadonlyMap<Hex, string>): Promise<PoolSwapLog[]> {
        const logs = await this.logsFetcher.getLogs({
            address: this.address,
            event: this.event,
            args: { id: Array.from(knownPools.keys()) },
            fromBlock: range.fromBlock,
            toBlock: range.toBlock,
        });

        return logs.map((log) => ({
            args: {
                id: log.args.id,
                sender: log.args.sender,
                amount0: log.args.amount0,
                amount1: log.args.amount1,
                sqrtPriceX96: log.args.sqrtPriceX96,
            },
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
        }));
    }

    private insert(logs: readonly PoolSwapLog[], knownPools: ReadonlyMap<Hex, string>): TradePayload[] {
        const swapTx = db.transaction((rows: readonly PoolSwapLog[]) => {
            const insertedTrades: TradePayload[] = [];

            for (const log of rows) {
                const tradePayload = this.toTradePayload(log, knownPools);
                const result = insertTrade.run(
                    tradePayload.txHash, tradePayload.logIndex, tradePayload.poolId,
                    tradePayload.repoId, tradePayload.sender,
                    tradePayload.amount0, tradePayload.amount1,
                    tradePayload.sqrtPriceX96, tradePayload.blockNumber,
                    tradePayload.ts
                );

                if (result.changes > 0) insertedTrades.push(tradePayload);
            }

            return insertedTrades;
        });

        return swapTx(logs);
    }

    private toTradePayload(log: PoolSwapLog, knownPools: ReadonlyMap<Hex, string>): TradePayload {
        const poolId = log.args.id.toLowerCase() as Hex;
        const repoId = knownPools.get(poolId);
        if (!repoId) throw new Error(`missing known pool for swap ${poolId}`);

        return {
            txHash: log.transactionHash,
            logIndex: log.logIndex,
            poolId,
            repoId,
            sender: log.args.sender,
            amount0: String(log.args.amount0),
            amount1: String(log.args.amount1),
            sqrtPriceX96: String(log.args.sqrtPriceX96),
            blockNumber: Number(log.blockNumber),
            ts: this.blockTs(log.blockNumber),
        };
    }

    private blockTs(blockNumber: bigint): number {
        const cached = this.blockTimestampCache.get(blockNumber);
        if (cached == null) throw new Error(`missing timestamp for block ${blockNumber}`);
        return cached;
    }

    private async cacheBlockTimestamp(blockNumber: bigint): Promise<void> {
        if (this.blockTimestampCache.has(blockNumber)) return;

        const block = await this.blockClient.getBlock({ blockNumber });
        this.blockTimestampCache.set(blockNumber, Number(block.timestamp));
    }

    private emitLiveTrade(tradePayload: TradePayload): void {
        const repoId = tradePayload.repoId;

        for (const interval of INTERVALS) {
            const secs = INTERVAL_SECS[interval];
            const bucket = Math.floor(tradePayload.ts / secs) * secs;
            const row = db.prepare(`
                SELECT ? AS time,
                    ${SQRT_TO_PRICE_SQL.replace("sqrtPriceX96", "MIN(sqrtPriceX96)")} AS low,
                    ${SQRT_TO_PRICE_SQL.replace("sqrtPriceX96", "MAX(sqrtPriceX96)")} AS high,
                    (SELECT ${SQRT_TO_PRICE_SQL} FROM trades
                        WHERE repo_id = ? AND ts BETWEEN ? AND ?
                        ORDER BY block_number ASC, log_index ASC LIMIT 1) AS open,
                    (SELECT ${SQRT_TO_PRICE_SQL} FROM trades
                        WHERE repo_id = ? AND ts BETWEEN ? AND ?
                        ORDER BY block_number DESC, log_index DESC LIMIT 1) AS close,
                    SUM(ABS(CAST(amount0 AS INTEGER))) AS volume
                FROM trades WHERE repo_id = ? AND ts BETWEEN ? AND ?
            `).get(
                bucket,
                repoId, bucket, bucket + secs - 1,
                repoId, bucket, bucket + secs - 1,
                repoId, bucket, bucket + secs - 1,
            ) as CandlePayload | undefined;

            if (row) this.publishLiveEvent(`candles:${repoId}:${interval}`, row);
        }

        this.publishLiveEvent(`trades:${repoId}`, tradePayload);
    }

    private publishLiveEvent(key: string, payload: unknown): void {
        this.publishEventMessage({ topic: "event", payload: { key, payload } });
    }
}
