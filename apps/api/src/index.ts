import fastify from "fastify";
import type { FastifyRequest } from "fastify";
import { EventEmitter } from "node:events";
import { exit } from "node:process";
import cors from "@fastify/cors";
import { createPublicClient, http, isAddress, parseAbiItem, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";
import { httpErrors } from "@fastify/sensible";
import { generateNonce, SiweMessage } from "siwe";
import secureSession from "@fastify/secure-session";
import { randomBytes } from 'node:crypto'
import { fetchOwnerUsername, fetchRepoMetaData, getGhClient, RepoMetaData } from "./shared/github";
import { getMeta, upsertMeta, db, type GithubMetaRow, type MarketRow, type RepoRow } from "./db/db";
import { FastifySSEPlugin } from "fastify-sse-v2";
import { EventsSocket, type EventMessage } from "./shared/events-socket";
import rateLimit from "@fastify/rate-limit";
import { registerCandles } from "./candles";
import { registerDepth } from "./depth";
import { registerWs } from "./ws";
import { AssetsLoader } from "./swaps/assets";
import { SwapHandler } from "./swaps/handler";
import { registerTradeRoutes } from "./swaps/routes";
import { UniswapSwapProvider } from "./swaps/uniswap";
import { createViemWalletValueBalanceReader, swapChain, WalletValueService } from "./swaps/wallet-value";

const APP_NAME                      = "registry-api";
const RIK_ADDRESS                   = process.env.CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL                       = (!process.env.RPC_URL || process.env.RPC_URL === "") ? "https://base-sepolia-rpc.publicnode.com" : process.env.RPC_URL;
const BASE_SEPOLIA_STATE_VIEW       = "0x571291b572ed32ce6751a2cb2486ebee8defb9b4";
const STATE_VIEW                    = (!process.env.STATE_VIEW || process.env.STATE_VIEW === "") ? BASE_SEPOLIA_STATE_VIEW : process.env.STATE_VIEW as `0x${string}`;
const DEFAULT_LIST_BLOCK_RANGE      = 1_200_000n; // backfill ~1 month
const ALLOWED_ORIGINS               = ["http://localhost:5173"];
const SIWE_DOMAIN                   = (!process.env.SIWE_DOMAIN || process.env.SIWE_DOMAIN === "") ? "localhost:5173" : process.env.SIWE_DOMAIN;
const SESSION_KEY                   = (!process.env.SESSION_KEY || process.env.SESSION_KEY === "") ? randomBytes(32) : process.env.SESSION_KEY;
const SESSION_COOKIE_SECURE         = process.env.SESSION_COOKIE_SECURE === "false" ? false : process.env.NODE_ENV === "production";
const GATE_TOKEN_ADDRESS            = process.env.GATE_TOKEN_ADDRESS as `0x${string}`;
const GATE_TOKEN_MIN_BALANCE        = process.env.GATE_TOKEN_MIN_BALANCE ?? 1;
const GITHUB_TOKEN                  = process.env.GITHUB_TOKEN;
const REPO_CACHE_TTL_MS             = 5 * 60_000; // 5 min
const GATE_CHECK_TTL_MS             = 15_000;
const DEFAULT_PAGE_SIZE             = 50;
const MAX_PAGE_SIZE                 = 200;
const SHOULD_RUN_INDEXER            = process.env.INDEXER === "1" || process.env.INDEXER?.toLowerCase() === "true";
const CHAIN_ID                      = baseSepolia.id;
const LAUNCHER_ADDRESS              = process.env.LAUNCHER_ADDRESS as `0x${string}` | undefined;
const V4_POOL_MANAGER               = process.env.V4_POOL_MANAGER as `0x${string}` | undefined;
const EVENTS_SOCKET_HOST            = (!process.env.EVENTS_SOCKET_HOST || process.env.EVENTS_SOCKET_HOST === "") ? "127.0.0.1" : process.env.EVENTS_SOCKET_HOST;
const EVENTS_SOCKET_LISTEN_HOST     = (!process.env.EVENTS_SOCKET_LISTEN_HOST || process.env.EVENTS_SOCKET_LISTEN_HOST === "") ? EVENTS_SOCKET_HOST : process.env.EVENTS_SOCKET_LISTEN_HOST;
const EVENTS_SOCKET_PORT            = readPort(process.env.EVENTS_SOCKET_PORT, 3055, "EVENTS_SOCKET_PORT");
const UNISWAP_API_KEY               = process.env.UNISWAP_API_KEY;
const UNISWAP_API_URL               = process.env.UNISWAP_API_URL;
const SWAP_ASSETS_FILE_PATH         = process.env.SWAP_ASSETS_FILE_PATH;
const SWAP_RPC_URL                  = process.env.SWAP_RPC_URL;

// server can't start with these
if (!RIK_ADDRESS)           die(new Error("RIK contract address is missing"));
if (!GATE_TOKEN_ADDRESS)    die(new Error("gate token address is missing"));
if (!GITHUB_TOKEN)          die(new Error("github token is missing"));
if (!LAUNCHER_ADDRESS)      die(new Error("Launcher address missing"));
if (!V4_POOL_MANAGER)       die(new Error("V4 Pool Manager address is missing"));

function readPort(value: string | undefined, fallback: number, name: string): number {
    if (!value || value === "") return fallback;

    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) die(new Error(`${name} must be a valid TCP port`));
    return port;
}

const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
});

const RepoRegisteredEvent = parseAbiItem("event RepoRegistered(uint256 indexed repoId, address indexed registrant, uint64 githubOwnerId, uint64 registeredAt)");
const MarketLaunchedEvent = parseAbiItem("event MarketLaunched(uint256 indexed repoId, address indexed asset, address indexed launcher)");
const SwapEvent = parseAbiItem("event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)");

const app = fastify({ logger: true });
const repoStreamEvents = new EventEmitter();
const marketDataEvents = new EventEmitter();
const tradableAssets = await AssetsLoader.load({
    cwd: process.cwd(),
    envPath: SWAP_ASSETS_FILE_PATH,
}).catch((err: unknown) => die(err));
const uniswapProvider = new UniswapSwapProvider(UNISWAP_API_KEY, UNISWAP_API_URL);
const swapHandler = new SwapHandler(uniswapProvider);
const swapBalanceClient = createPublicClient({
    chain: swapChain(tradableAssets.chainId),
    transport: http(SWAP_RPC_URL),
});
const walletValue = new WalletValueService({
    assets: tradableAssets,
    quoteProvider: uniswapProvider,
    balanceReader: createViemWalletValueBalanceReader(tradableAssets.chainId, swapBalanceClient),
});

try { registerOrigins(ALLOWED_ORIGINS); } catch (err) { die(err); }

attachEventsSocket();

function attachEventsSocket(): void {
    if (SHOULD_RUN_INDEXER) return;

    EventsSocket.create({
        host: EVENTS_SOCKET_HOST,
        listenHost: EVENTS_SOCKET_LISTEN_HOST,
        port: EVENTS_SOCKET_PORT,
        onError: (err) => app.log.warn({ err }, "events socket error"),
    }).attach(handleEventsSocketMessage);
}

function handleEventsSocketMessage(message: EventMessage): void {
    if (message.topic === "repo") {
        repoStreamEvents.emit("repo", message.payload);
        return;
    }

    if (message.topic === "event") {
        if (!isHubEventPayload(message.payload)) {
            app.log.warn({ topic: message.topic }, "invalid events socket payload");
            return;
        }

        marketDataEvents.emit("event", message.payload.key, message.payload.payload);
        return;
    }

    app.log.warn({ topic: message.topic }, "unknown events socket topic");
}

function isHubEventPayload(value: unknown): value is { key: string; payload: unknown } {
    return typeof value === "object" && value !== null &&
        "key" in value && typeof value.key === "string" && value.key.length > 0 && "payload" in value;
}

// augment module -> add address
declare module "@fastify/secure-session" {
    interface SessionData { address?: `0x${string}`; }
}

app.register(secureSession, {
    key: Buffer.from(SESSION_KEY),
    cookie: {
        path: "/",
        httpOnly: true,
        secure: SESSION_COOKIE_SECURE,
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // one day
    },
});
app.register(FastifySSEPlugin);

await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.session.get("address") ?? req.ip,
    errorResponseBuilder: (_, ctx) => ({
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate Limit exceeded. Try again in ${ctx.after}`
    }),
});

type Cache<T> = { value: T, at: number };
type RepoGithubCache = { metadata: RepoMetaData | null; ownerUsername: string | null };
type RepoPayload = {
    repoId: string;
    registrant: string;
    githubOwnerId: number;
    githubOwnerUsername: string;
    registeredAt: number;
    blockNumber: number;
    transactionHash: string | null;
    chainId: number;
    registryAddress: `0x${string}`;
    github: RepoMetaData | "not found";
};
type RepoStreamPayload = RepoPayload;
type RepoWithMetaRow = RepoRow & Pick<GithubMetaRow, "full_name" | "description" | "language" | "stars" | "html_url" | "owner_name">;
type Sort = "registered_at_desc" | "stars_desc" | "registered_at_asc";

const repoCache = new Map<string, Cache<RepoGithubCache>>();
const gateCache = new Map<`0x${string}`, Cache<Promise<boolean>>>();

const ORDER: Record<Sort, string> = {
    registered_at_asc:  "r.registered_at ASC, r.repo_id ASC",
    registered_at_desc: "r.registered_at DESC, r.repo_id DESC",
    stars_desc:         "m.stars IS NULL, m.stars DESC, r.registered_at DESC, r.repo_id DESC",
};

registerRepoListRoute();

function registerRepoListRoute(): void {
    app.get("/api/repos", async (req, reply) => {
        const raw = req.query && typeof req.query === "object" ? req.query as Record<string, unknown> : {};
        const q = typeof raw.q === "string" ? raw.q.trim() : "";
        const sort = raw.sort ?? "registered_at_desc";
        if (typeof sort !== "string" || !(sort in ORDER)) throw httpErrors.badRequest("invalid sort");

        const limitRaw = Number(raw.limit ?? DEFAULT_PAGE_SIZE);
        const cursorRaw = Number(raw.cursor ?? 0);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
        const offset = Number.isFinite(cursorRaw) ? Math.min(Math.max(Math.trunc(cursorRaw), 0), Number.MAX_SAFE_INTEGER) : 0;

        const where: string[] = ["r.chain_id = ?"];
        const params: any[] = [CHAIN_ID];

        if (q) {
            const like = `%${q}%`;
            where.push(`(
            r.repo_id LIKE ? OR r.registrant LIKE ? OR CAST(r.github_owner_id AS TEXT) LIKE ? OR
            m.full_name LIKE ? OR m.description LIKE ? OR m.language LIKE ? OR m.owner_name LIKE ?
        )`);
            params.push(like, like, like, like, like, like, like);
        }

        const whereSql = `WHERE ${where.join(" AND ")}`;
        const rows = db.prepare(`
        SELECT r.repo_id, r.registrant, r.github_owner_id, r.registered_at, r.block_number, r.transaction_hash, r.chain_id,
               m.full_name, m.description, m.language, m.stars, m.html_url, m.owner_name
        FROM repos r
        LEFT JOIN github_meta m ON m.repo_id = r.repo_id
        ${whereSql}
        ORDER BY ${ORDER[sort as Sort]}
        LIMIT ? OFFSET ?
    `).all(...params, limit + 1, offset) as RepoWithMetaRow[];
        const page = rows.slice(0, limit);
        const nextCursor = rows.length > limit ? offset + limit : null;

        const repos = await Promise.all(page.map(async (repo) => {
            const key = repo.repo_id;
            const now = Date.now();
            const hit = repoCache.get(key);
            let value = hit && now - hit.at < REPO_CACHE_TTL_MS ? hit.value : null;

            if (!value) {
                // GitHub metadata is mutable but not critical consensus data. Cache both
                // positive and negative lookups to avoid burning rate limit on missing repos.
                const stored = getMeta.get(key) as GithubMetaRow | undefined;
                const storedValue: RepoGithubCache | null = stored ? {
                    metadata: stored.full_name && stored.html_url ? {
                        fullName: stored.full_name,
                        description: stored.description,
                        language: stored.language,
                        stars: stored.stars ?? 0,
                        htmlUrl: stored.html_url,
                    } : null,
                    ownerUsername: stored.owner_name,
                } : null;

                if (storedValue && stored && now - stored.fetched_at < REPO_CACHE_TTL_MS) value = storedValue;
                else {
                    try {
                        const gh = getGhClient();
                        const [metadata, ownerUsername] = await Promise.all([
                            fetchRepoMetaData(gh, Number(key)),
                            fetchOwnerUsername(gh, repo.github_owner_id),
                        ]);
                        value = { metadata, ownerUsername };
                        upsertMeta.run(key, metadata?.fullName ?? null, metadata?.description ?? null, metadata?.language ?? null, metadata?.stars ?? null, metadata?.htmlUrl ?? null, ownerUsername, now);
                    } catch (err) {
                        // GitHub is enrichment, not the registry source of truth. If we have
                        // stale metadata, keep the registry usable and retry on a later request.
                        if (!storedValue) throw err;
                        value = storedValue;
                    }
                }

                repoCache.set(key, { value, at: now });
            }

            return {
                repoId: repo.repo_id,
                registrant: repo.registrant,
                githubOwnerId: repo.github_owner_id,
                githubOwnerUsername: value.ownerUsername ?? "not found",
                registeredAt: repo.registered_at,
                blockNumber: repo.block_number,
                transactionHash: repo.transaction_hash,
                chainId: repo.chain_id,
                registryAddress: RIK_ADDRESS,
                github: value.metadata ?? "not found",
            }
        }));
        return reply.type("application/json; charset=utf-8").send({ repos, nextCursor });
    });
}

function repoPayloadFromRow(row: RepoWithMetaRow): RepoStreamPayload {
    return {
        repoId: row.repo_id,
        registrant: row.registrant,
        githubOwnerId: row.github_owner_id,
        githubOwnerUsername: row.owner_name ?? "not found",
        registeredAt: row.registered_at,
        blockNumber: row.block_number,
        transactionHash: row.transaction_hash,
        chainId: row.chain_id,
        registryAddress: RIK_ADDRESS,
        github: row.full_name && row.html_url ? {
            fullName: row.full_name,
            description: row.description,
            language: row.language,
            stars: row.stars ?? 0,
            htmlUrl: row.html_url,
        } : "not found",
    };
}

type MarketWithMetaRow = MarketRow & Pick<GithubMetaRow, "full_name">;
type MarketPayload = {
    repoId: string;
    asset: `0x${string}`;
    symbol: string;
    poolId: `0x${string}`;
    hook: `0x${string}`;
    launchedAt: number;
    launcher: `0x${string}`;
    poolKey: {
        currency0: `0x${string}`;
        currency1: `0x${string}`;
        fee: number;
        tickSpacing: number;
        hooks: `0x${string}`;
    };
};

registerMarketRoutes();
registerTradeRoutes(app, {
    chainId: tradableAssets.chainId,
    handler: swapHandler,
    assets: tradableAssets,
    walletValue,
    preHandler: requireApiAccess,
});

function registerMarketRoutes(): void {
    app.get("/api/markets", async () => {
        const rows = db.prepare(`
        SELECT mk.repo_id, mk.asset, mk.hook, mk.pool_id, mk.currency0, mk.currency1,
               mk.fee, mk.tick_spacing, mk.launched_at, mk.launcher, meta.full_name
        FROM markets mk
        LEFT JOIN github_meta meta ON meta.repo_id = mk.repo_id
        WHERE mk.currency0 IS NOT NULL
          AND mk.currency1 IS NOT NULL
          AND mk.fee IS NOT NULL
          AND mk.tick_spacing IS NOT NULL
        ORDER BY mk.launched_at DESC, mk.repo_id DESC
    `).all() as MarketWithMetaRow[];

        return { markets: rows.map(marketPayloadFromRow) };
    });

    app.get<{ Params: { repoId: string } }>("/api/market/:repoId", async (req) => {
        const row = db.prepare(`
        SELECT mk.repo_id, mk.asset, mk.hook, mk.pool_id, mk.currency0, mk.currency1,
               mk.fee, mk.tick_spacing, mk.launched_at, mk.launcher, meta.full_name
        FROM markets mk
        LEFT JOIN github_meta meta ON meta.repo_id = mk.repo_id
        WHERE mk.repo_id = ?
          AND mk.currency0 IS NOT NULL
          AND mk.currency1 IS NOT NULL
          AND mk.fee IS NOT NULL
          AND mk.tick_spacing IS NOT NULL
    `).get(req.params.repoId) as MarketWithMetaRow | undefined;

        if (!row) throw httpErrors.notFound("market not found");

        return { market: marketPayloadFromRow(row) };
    });

    app.get<{
        Params: { repoId: string };
        Querystring: { limit?: number };
    }>("/api/market/:repoId/trades", async (req) => {
        const limitRaw = Number(req.query.limit ?? 1000);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 5000) : 1000;
        const rows = db.prepare(`
        SELECT tx_hash,
               log_index,
               block_number,
               ts,
               amount0,
               amount1,
               POW(CAST(sqrtPriceX96 AS REAL) / POW(2.0, 96), 2) AS price
        FROM trades
        WHERE repo_id = ?
        ORDER BY ts DESC, block_number DESC, log_index DESC
        LIMIT ?
    `).all(req.params.repoId, limit) as { tx_hash: string; log_index: number; block_number: number; ts: number; amount0: string; amount1: string; price: number }[];

        return rows.map((row) => {
            const amount0 = BigInt(row.amount0);
            const amount1 = BigInt(row.amount1);
            const size = amount1 < 0n ? -amount1 : amount1;

            return {
                txHash: row.tx_hash,
                logIndex: row.log_index,
                blockNumber: row.block_number,
                ts: row.ts,
                price: row.price,
                size: size.toString(),
                side: amount0 < 0n ? "buy" : "sell",
            };
        });
    });
}

function marketPayloadFromRow(row: MarketWithMetaRow): MarketPayload {
    if (row.currency0 == null || row.currency1 == null || row.fee == null || row.tick_spacing == null) {
        throw new Error(`market ${row.repo_id} is missing pool key data`);
    }

    return {
        repoId: row.repo_id,
        asset: row.asset as `0x${string}`,
        symbol: marketSymbolFromRow(row),
        poolId: row.pool_id as `0x${string}`,
        hook: row.hook as `0x${string}`,
        launchedAt: row.launched_at,
        launcher: row.launcher as `0x${string}`,
        poolKey: {
            currency0: row.currency0 as `0x${string}`,
            currency1: row.currency1 as `0x${string}`,
            fee: row.fee,
            tickSpacing: row.tick_spacing,
            hooks: row.hook as `0x${string}`,
        },
    };
}

function marketSymbolFromRow(row: Pick<MarketWithMetaRow, "full_name" | "repo_id">): string {
    const fullName = row.full_name?.trim();
    if (!fullName) return `RIK-${row.repo_id}`;

    return fullName.split("/").at(-1)?.slice(0, 16).toUpperCase() || `RIK-${row.repo_id}`;
}

registerRootRoute();

function registerRootRoute(): void {
    app.get("/", async () => ({
        name: APP_NAME,
        endpoints: ["/api/repos", "/api/markets", "/api/trade/assets", "/api/trade/wallet-value", "/api/trade/swaps", "/api/auth/nonce", "/api/auth/verify"],
    }));
}

// address -> nonce (single-use)
// all address must be stored normalized in lower case here
const nonces = new Map<string, string>();

registerAuthRoutes();

function registerAuthRoutes(): void {
    app.get<{ Querystring: { address?: string } }>("/api/auth/nonce", async(req) => {
        const address = readAddress(req.query.address);
        const nonce = generateNonce(); // 8+ alphanumeric -> EIP-4361 standard
        nonces.set(address, nonce);
        return {nonce};
    });

    app.post<{ Body: { message?: string; signature?: string } | undefined }>("/api/auth/verify", async(req) => {
        const message = readMessage(req.body?.message);
        const signature = readSignature(req.body?.signature);

        const siwe = new SiweMessage(message);
        const expectedNonce = nonces.get(siwe.address.toLowerCase());
        if (!expectedNonce) throw httpErrors.unauthorized("no nonce");

        // clean after verification -> single-use
        nonces.delete(siwe.address.toLowerCase());

        const result = await siwe.verify({
            signature,
            domain: SIWE_DOMAIN,
            nonce: expectedNonce,
        });
        if (!result.success) throw httpErrors.unauthorized("bad signature");
        if (!(await checkGate(siwe.address as `0x${string}`))) throw httpErrors.unauthorized("insufficient $FREECODE balance");
        req.session.set("address", siwe.address as `0x${string}`);
        return { ok: true, address: siwe.address };
    });

    app.get("/api/auth/me", async(req, _) => {
        const address = req.session.get("address");
        if (!address) throw httpErrors.unauthorized("not signed in");
        return { address };
    });

    app.post("/api/auth/logout", async(req, _) => {
        req.session.delete();
        return { ok: true };
    });
}

function readMessage(message: unknown): string {
    if (typeof message !== "string" || !message) throw httpErrors.badRequest("message is required");
    return message as string;
}

function readAddress(address: unknown): `0x${string}` {
    if (typeof address !== "string" || !address) throw httpErrors.badRequest("address required");
    if (!isAddress(address)) throw httpErrors.badRequest("invalid address");
    return address.toLowerCase() as `0x${string}`;
}

function readSignature(signature: unknown): `0x${string}` {
    if (typeof signature !== "string" || !signature.startsWith("0x")) throw httpErrors.badRequest("signature required");
    return signature as `0x${string}`;
}

registerRepoStreamRoute();

function registerRepoStreamRoute(): void {
    app.get("/api/repos/stream", async (req, reply) => {
        // check token gate freshness to cut off
        const address = req.session.get("address");
        if (!address || !(await checkGate(address))) return httpErrors.unauthorized("not entitled");

        const interval  = setInterval(async () => {
            if (!(await checkGate(address))) {
                reply.sse({ event: "revoked", data: "$FREECODE balance below threshold" });
                reply.raw.end(); clearInterval(interval);
            }
        }, 60_000);

        req.raw.on("close", () => clearInterval(interval));

        // on reconnect replay everything since lastId -> read from db
        const lastId = req.headers["last-event-id"];

        if (typeof lastId === "string" && lastId) {
            const rows = db.prepare(
                `SELECT r.repo_id, r.registrant, r.github_owner_id, r.registered_at, r.block_number, r.transaction_hash, r.chain_id,
                    m.full_name, m.description, m.language, m.stars, m.html_url, m.owner_name
             FROM repos r
             LEFT JOIN github_meta m ON m.repo_id = r.repo_id
              WHERE r.chain_id = ? AND r.block_number > ?
              ORDER BY r.block_number`
            ).all(CHAIN_ID, Number(lastId)) as RepoWithMetaRow[];

            for (const row of rows) {
                const payload = repoPayloadFromRow(row);
                reply.sse({ id: String(payload.blockNumber), data: JSON.stringify(payload) });
            }
        }
        const listener = (row: RepoStreamPayload) => reply.sse({ id: String(row.blockNumber), data: JSON.stringify(row) });
        repoStreamEvents.on("repo", listener); req.raw.on("close", () => repoStreamEvents.off("repo", listener));
    });
}

registerApiGateHook();

function registerApiGateHook(): void {
    // token gate-check every request
    app.addHook("preHandler", requireApiAccess);
}

async function requireApiAccess(req: FastifyRequest): Promise<void> {
        // skip non-api routes + auth flow
        if (!req.url.startsWith("/api/")) return;
        if (req.url.startsWith("/api/auth/")) return;

        const address = req.session.get("address");
        if (!address) throw httpErrors.unauthorized("not signed in");
        if (!(await checkGate(address))) throw httpErrors.unauthorized("insufficient $FREECODE balance");
}

async function checkGate(address: `0x${string}`): Promise<boolean> {
    const now = Date.now();
    const key = address.toLowerCase() as `0x${string}`;
    const hit = gateCache.get(key);
    if (hit && now - hit.at < GATE_CHECK_TTL_MS) return hit.value;

    const result = client.readContract({
        address: GATE_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
    }).then((balance) => balance >= BigInt(GATE_TOKEN_MIN_BALANCE));

    gateCache.set(key, { value: result, at: now });

    try {
        return await result;
    } catch (err) {
        gateCache.delete(key);
        throw err;
    }
}

await app.register(registerCandles);
await app.register(registerDepth);
await registerWs(app, marketDataEvents, async (req) => {
    const address = req.session.get("address");
    return address ? await checkGate(address) : false;
});

function registerOrigins(origins: string[]): void {
    // origins can be passed with ALLOWED_ORIGINS through env vars
    // check if process.env.ALLOWED_ORIGINS is defined and if is a valid string[] type
    let parsed: unknown;
    try {
        if (process.env.ALLOWED_ORIGINS) parsed = JSON.parse(process.env.ALLOWED_ORIGINS);
    } catch (err) { throw new Error("unable to parse ALLOWED_ORIGINS") }
    if (process.env.ALLOWED_ORIGINS && (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string"))) throw new Error("ALLOWED_ORIGINS must be a valid JSON array of strings");

    if (!origins || origins.length == 0) return;

    // at this stage if ALLOWED_ORIGINS is defined in env parsed have already been verified to be string[] type
    const allowedOrigins = process.env.ALLOWED_ORIGINS && Array.isArray(parsed) ? origins.concat(parsed) : origins;
    app.register(cors, { origin: allowedOrigins, credentials: true });
    return;
}

function die(err: any): never {
    let error = "unknown error";
    if (err instanceof Error) error = err.message;
    console.error(`${APP_NAME}: ${error}; exiting.`);
    exit(1);
}

if(!SHOULD_RUN_INDEXER) await app.listen({ port: 3000, host: "0.0.0.0" });

export {client, RepoRegisteredEvent, MarketLaunchedEvent, SwapEvent, RIK_ADDRESS, STATE_VIEW, DEFAULT_LIST_BLOCK_RANGE, CHAIN_ID, LAUNCHER_ADDRESS, V4_POOL_MANAGER};
