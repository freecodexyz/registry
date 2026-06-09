import { db, insertRepo, upsertMeta } from "./db";
import { client, RIK_ADDRESS, RepoRegisteredEvent, DEFAULT_LIST_BLOCK_RANGE } from "./index";
import { fetchOwnerUsername, fetchRepoMetaData, getGhClient } from "./github";
import { registryEvents } from "./events";

const POLL_MS   = 12_000; // one Sepolia block time
const SHOULD_RUN_INDEXER = process.env.INDEXER === "1" || process.env.INDEXER?.toLowerCase() === "true";

const gh = getGhClient();

async function getLastIndexedBlock(): Promise<bigint> {
    const row = db.prepare("SELECT value FROM indexer_state WHERE key='last_block'").get() as { value: string } | undefined;
    return row ? BigInt(row.value) : (await client.getBlockNumber()) - DEFAULT_LIST_BLOCK_RANGE;
}

function setLastIndexedBlock(n: bigint) {
    db.prepare(
        "INSERT INTO indexer_state (key, value) VALUES ('last_block', ?) " +
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).run(String(n));
}

export async function tick() {
    const head = await client.getBlockNumber();
    const from = await getLastIndexedBlock() + 1n;
    if (from > head) return;
    const logs = await client.getLogs({
        address: RIK_ADDRESS, event: RepoRegisteredEvent, fromBlock: from, toBlock: head
    });
    const tx = db.transaction((rows: any[]) => {
        for (const l of rows) {
            insertRepo.run(
                String(l.args.repoId), l.args.registrant,
                Number(l.args.githubOwnerId), Number(l.args.registeredAt),
                Number(l.blockNumber)
            );
        }
    });
    tx(logs);
    setLastIndexedBlock(head);

    // best effort enrichment
    for (const l of logs) {
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
            github: metadata ?? "not found",
        });
    }
}

if (SHOULD_RUN_INDEXER) {
    console.log("Starting indexer");
    setInterval(() => { tick().catch(console.error); }, POLL_MS);
    tick();
}
