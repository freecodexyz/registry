import { db } from "./db/db";
import { client, RIK_ADDRESS, RepoRegisteredEvent, MarketLaunchedEvent, SwapEvent, DEFAULT_LIST_BLOCK_RANGE, CHAIN_ID, LAUNCHER_ADDRESS, V4_POOL_MANAGER } from "./index";
import { getGhClient } from "./shared/github";
import { EventsSocket, type EventMessage } from "./shared/events-socket";
import { BlockCheckpointStore } from "./indexer/checkpoint";
import { IndexerEngine } from "./indexer/engine";
import { LogsFetcher } from "./indexer/fetch-logs";
import { MarketLaunchIndexer } from "./indexer/market-launches";
import { PoolSwapIndexer } from "./indexer/pool-swaps";
import { RepoRegistrationIndexer } from "./indexer/repo-registrations";

const POLL_MS   = 12_000;
const SHOULD_RUN_INDEXER = process.env.INDEXER === "1" || process.env.INDEXER?.toLowerCase() === "true";
const EVENTS_SOCKET_HOST = (!process.env.EVENTS_SOCKET_HOST || process.env.EVENTS_SOCKET_HOST === "") ? "127.0.0.1" : process.env.EVENTS_SOCKET_HOST;
const EVENTS_SOCKET_PORT = readPort(process.env.EVENTS_SOCKET_PORT, 3055, "EVENTS_SOCKET_PORT");
const INDEXER_STATE_KEY = `last_block:${CHAIN_ID}:${RIK_ADDRESS.toLowerCase()}`;
const gh = getGhClient();
const logsFetcher = new LogsFetcher(client, DEFAULT_LIST_BLOCK_RANGE);
const checkpoint = new BlockCheckpointStore({
    db,
    key: INDEXER_STATE_KEY,
    maxLookbackBlocks: DEFAULT_LIST_BLOCK_RANGE,
});
const eventsSocket = EventsSocket.create({
    host: EVENTS_SOCKET_HOST,
    port: EVENTS_SOCKET_PORT,
    onError: (error) => console.error("events socket error", error),
});
const repoRegistrations = new RepoRegistrationIndexer({
    address: RIK_ADDRESS,
    event: RepoRegisteredEvent,
    chainId: CHAIN_ID,
    registryAddress: RIK_ADDRESS,
    logsFetcher,
    github: gh,
    publishEventMessage,
});
const marketLaunches = new MarketLaunchIndexer({
    address: LAUNCHER_ADDRESS,
    event: MarketLaunchedEvent,
    logsFetcher,
    receiptClient: client,
});
const poolSwaps = new PoolSwapIndexer({
    address: V4_POOL_MANAGER,
    event: SwapEvent,
    logsFetcher,
    blockClient: client,
    publishEventMessage,
});
const indexer = new IndexerEngine({
    client,
    checkpoint,
    steps: [repoRegistrations, marketLaunches, poolSwaps],
});

function publishEventMessage(message: EventMessage): void {
    eventsSocket.write(message).catch((error: unknown) => {
        console.error("failed to publish live event", error);
    });
}

function readPort(value: string | undefined, fallback: number, name: string): number {
    if (!value || value === "") return fallback;

    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`${name} must be a valid TCP port`);
    return port;
}


// start the indexer
if (SHOULD_RUN_INDEXER) {
    console.log("Starting indexer");
    setInterval(() => { indexer.tick().catch(console.error); }, POLL_MS);
    indexer.tick();
}
