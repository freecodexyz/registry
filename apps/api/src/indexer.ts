import { decodeEventLog, parseAbiItem, type Address, type Hash, type Hex } from "viem";
import { db, insertMarket, insertRepo, insertTrade, upsertMeta } from "./db";
import { client, RIK_ADDRESS, RepoRegisteredEvent, MarketLaunchedEvent, SwapEvent, DEFAULT_LIST_BLOCK_RANGE, CHAIN_ID, LAUNCHER_ADDRESS, V4_POOL_MANAGER } from "./index";
import { fetchOwnerUsername, fetchRepoMetaData, getGhClient } from "./github";
import { registryEvents } from "./events";

const POLL_MS   = 12_000;
const SHOULD_RUN_INDEXER = process.env.INDEXER === "1" || process.env.INDEXER?.toLowerCase() === "true";
const INDEXER_STATE_KEY = `last_block:${CHAIN_ID}:${RIK_ADDRESS.toLowerCase()}`;
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

const AirlockCreateEvent = parseAbiItem("event Create(address asset, address indexed numeraire, address initializer, address poolOrHook)");
const PoolManagerInitializeEvent = parseAbiItem("event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)");

const gh = getGhClient();
const blockTimestampCache = new Map<bigint, number>();

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

async function getLastIndexedBlock(head: bigint): Promise<bigint> {
    const row = db.prepare("SELECT value FROM indexer_state WHERE key=?").get(INDEXER_STATE_KEY) as { value: string } | undefined;
    const oldestAvailableBlock = head > DEFAULT_LIST_BLOCK_RANGE ? head - DEFAULT_LIST_BLOCK_RANGE : 0n;
    const lastIndexedBlock = row ? BigInt(row.value) : oldestAvailableBlock;
    if (lastIndexedBlock < oldestAvailableBlock) {
        setLastIndexedBlock(oldestAvailableBlock);
        return oldestAvailableBlock;
    }
    return lastIndexedBlock;
}

function setLastIndexedBlock(n: bigint) {
    db.prepare(
        "INSERT INTO indexer_state (key, value) VALUES (?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(INDEXER_STATE_KEY, String(n));
}

export async function tick() {
    const head = await client.getBlockNumber();
    const from = await getLastIndexedBlock(head) + 1n;
    if (from > head) return;

    // RIK Minting events
    const repoCreatedLogs = await client.getLogs({
        address: RIK_ADDRESS, event: RepoRegisteredEvent, fromBlock: from, toBlock: head
    });
    const repoCreatedTx = db.transaction((logs: any[]) => {
        for (const l of logs) {
            insertRepo.run(
                String(l.args.repoId), l.args.registrant,
                Number(l.args.githubOwnerId), Number(l.args.registeredAt),
                Number(l.blockNumber), l.transactionHash ?? null, CHAIN_ID
            );
        }
    });
    repoCreatedTx(repoCreatedLogs);

    // RIKLauncher Events -> market creation
    const launchLogs = await client.getLogs({
        address: LAUNCHER_ADDRESS, event: MarketLaunchedEvent, fromBlock: from, toBlock: head
    });

    // we first loop through the logs cause doing it inside db.transaction is not safe can result in bad data ending up in the db
    const launchesParsed = await Promise.all(launchLogs.map(async (log) => ({
        log,
        ...(await parseHookFromTx(log.transactionHash)),
    })));

    const launchTx = db.transaction((rows: typeof launchesParsed) => {
        for (const { log: l, hook, poolId, currency0, currency1, fee, tickSpacing } of rows) {
            insertMarket.run(
                String(l.args.repoId), l.args.asset, hook, poolId,
                currency0, currency1, fee, tickSpacing,
                Number(l.blockNumber), l.args.launcher,
            );
        }
    }) 
    launchTx(launchesParsed);

    // Market pool swap events
    const knownPools = new Map<Hex, string>((() => {
        const rows = db.prepare("SELECT pool_id, repo_id FROM markets").all() as any[]
        return rows.map((r: any) => [r.pool_id.toLowerCase(), r.repo_id])
    })()
    );
    if (knownPools.size === 0) return; // <-- nothing to index yet

    const swaps = await client.getLogs({
        address: V4_POOL_MANAGER, event: SwapEvent,
        args: { id: Array.from(knownPools.keys()) as `0x${string}`[] },
        fromBlock: from, toBlock: head
    });

    await Promise.all(swaps.map((l) => cacheBlockTimestamp(l.blockNumber)));

    const swapTx = db.transaction((logs: typeof swaps) => {
        const insertedTrades: TradePayload[] = [];

        for (const l of logs) {
            const poolId = l.args.id.toLowerCase() as Hex;
            const repoId = knownPools.get(poolId)!;
            const tradePayload = {
                txHash: l.transactionHash,
                logIndex: l.logIndex,
                poolId,
                repoId,
                sender: l.args.sender,
                amount0: String(l.args.amount0),
                amount1: String(l.args.amount1),
                sqrtPriceX96: String(l.args.sqrtPriceX96),
                blockNumber: Number(l.blockNumber),
                ts: blockTs(l.blockNumber),
            } satisfies TradePayload;

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
    const insertedTrades = swapTx(swaps);
    for (const tradePayload of insertedTrades) emitLiveTrade(tradePayload);
   

    setLastIndexedBlock(head);

    // best effort enrichment
    for (const l of repoCreatedLogs) {
        const [metadata, ownerUsername] = await Promise.all([
            fetchRepoMetaData(gh, Number(l.args.repoId)),
            fetchOwnerUsername(gh, l.args.githubOwnerId),
        ]);
        upsertMeta.run(String(l.args.repoId), metadata?.fullName ?? null, metadata?.description ?? null,
            metadata?.language ?? null, metadata?.stars ?? null, metadata?.htmlUrl ?? null, ownerUsername, Date.now());
        
        registryEvents.emit("repo", {
            repoId: String(l.args.repoId),
            registrant: l.args.registrant,
            githubOwnerId: Number(l.args.githubOwnerId),
            githubOwnerUsername: ownerUsername ?? "not found",
            registeredAt: Number(l.args.registeredAt),
            blockNumber: Number(l.blockNumber),
            transactionHash: l.transactionHash ?? null,
            chainId: CHAIN_ID,
            registryAddress: RIK_ADDRESS,
            github: metadata ?? "not found",
        });
    }
}

// helpers
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

async function parseHookFromTx(tx: Hash | null): Promise<ParseHookResult> {
    if (!tx) throw new Error("market launch log is missing transaction hash");

    const receipt = await client.getTransactionReceipt({ hash: tx });
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
};

function blockTs(blockNumber: bigint): number {
    const cached = blockTimestampCache.get(blockNumber);
    if (cached == null) throw new Error(`missing timestamp for block ${blockNumber}`);
    return cached;
}

function emitLiveTrade(tradePayload: TradePayload): void {
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

        if (row) registryEvents.emit("event", `candles:${repoId}:${interval}`, row);
    }

    registryEvents.emit("event", `trades:${repoId}`, tradePayload);
}

async function cacheBlockTimestamp(blockNumber: bigint): Promise<void> {
    if (blockTimestampCache.has(blockNumber)) return;

    const block = await client.getBlock({ blockNumber });
    blockTimestampCache.set(blockNumber, Number(block.timestamp));
}


// start the indexer
if (SHOULD_RUN_INDEXER) {
    console.log("Starting indexer");
    setInterval(() => { tick().catch(console.error); }, POLL_MS);
    tick();
}
