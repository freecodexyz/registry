import { decodeEventLog, parseAbiItem, type Address, type Hash, type Hex } from "viem";
import { db, insertMarket, insertRepo, upsertMeta } from "./db";
import { client, RIK_ADDRESS, RepoRegisteredEvent, MarketLaunchedEvent, DEFAULT_LIST_BLOCK_RANGE, CHAIN_ID, LAUNCHER_ADDRESS } from "./index";
import { fetchOwnerUsername, fetchRepoMetaData, getGhClient } from "./github";
import { registryEvents } from "./events";

const POLL_MS   = 12_000;
const SHOULD_RUN_INDEXER = process.env.INDEXER === "1" || process.env.INDEXER?.toLowerCase() === "true";
const INDEXER_STATE_KEY = `last_block:${CHAIN_ID}:${RIK_ADDRESS.toLowerCase()}`;

const AirlockCreateEvent = parseAbiItem("event Create(address asset, address indexed numeraire, address initializer, address poolOrHook)");
const PoolManagerInitializeEvent = parseAbiItem("event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)");

const gh = getGhClient();
const blockTimestampCache = new Map<bigint, number>();

async function getLastIndexedBlock(): Promise<bigint> {
    const row = db.prepare("SELECT value FROM indexer_state WHERE key=?").get(INDEXER_STATE_KEY) as { value: string } | undefined;
    return row ? BigInt(row.value) : (await client.getBlockNumber()) - DEFAULT_LIST_BLOCK_RANGE;
}

function setLastIndexedBlock(n: bigint) {
    db.prepare(
        "INSERT INTO indexer_state (key, value) VALUES (?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(INDEXER_STATE_KEY, String(n));
}

export async function tick() {
    const head = await client.getBlockNumber();
    const from = await getLastIndexedBlock() + 1n;
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


    const launchLogs = await client.getLogs({
        address: LAUNCHER_ADDRESS, event: MarketLaunchedEvent, fromBlock: from, toBlock: head
    });

    // we first loop through the logs cause doing it inside db.transaction is not safe can result in bad data ending up in the db
    const launchesParsed = await Promise.all(launchLogs.map(async (log) => ({
        log,
        ...(await parseHookFromTx(log.transactionHash)),
    })));

    const launchTx = db.transaction((rows: typeof launchesParsed) => {
        for (const { log: l, hook, poolId } of rows) {
            insertMarket.run(String(l.args.repoId), l.args.asset, hook, poolId, Number(l.blockNumber), l.args.launcher);
        }
    }) 
    launchTx(launchesParsed);
   

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
type ParseHookResult = { hook: Address; poolId: Hex };
type AirlockCreateDecoded = { args: { poolOrHook: Address } };
type PoolManagerInitializeDecoded = { args: { id: Hex } };

async function parseHookFromTx(tx: Hash | null): Promise<ParseHookResult> {
    if (!tx) throw new Error("market launch log is missing transaction hash");

    const receipt = await client.getTransactionReceipt({ hash: tx });
    let hook: Address | undefined;
    let poolId: Hex | undefined;

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
            poolId = decoded.args.id;
        } catch {}

        if (hook && poolId) return { hook, poolId };
    }

    throw new Error(`missing Airlock Create or PoolManager Initialize event in tx ${tx}`);
};


// start the indexer
if (SHOULD_RUN_INDEXER) {
    console.log("Starting indexer");
    setInterval(() => { tick().catch(console.error); }, POLL_MS);
    tick();
}
