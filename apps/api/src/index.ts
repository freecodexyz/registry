import fastify from "fastify";
import { exit } from "node:process";
import cors from "@fastify/cors";
import { createPublicClient, http, isAddress, parseAbiItem, erc20Abi } from "viem";
import { sepolia } from "viem/chains";
import { httpErrors } from "@fastify/sensible";
import { generateNonce, SiweMessage } from "siwe";
import secureSession from "@fastify/secure-session";
import { randomBytes } from 'node:crypto'
import { fetchOwnerUsername, fetchRepoMetaData, getGhClient, RepoMetaData } from "./github";
import { getMeta, insertRepo, listRepos, upsertMeta, db, type GithubMetaRow, type RepoRow } from "./db";
import { FastifySSEPlugin } from "fastify-sse-v2";
import { registryEvents } from "./events";
import rateLimit from "@fastify/rate-limit";

const APP_NAME                      = "registry-api";
const RIK_ADDRESS                   = process.env.CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL                       = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_LIST_BLOCK_RANGE      = 50_000n;
const ALLOWED_ORIGINS               = ["http://localhost:5173"];
const SIWE_DOMAIN                   = process.env.SIWE_DOMAIN ?? "localhost:5173";
const SESSION_KEY                   = process.env.SESSION_KEY ?? randomBytes(32);
const GATE_TOKEN_ADDRESS            = process.env.GATE_TOKEN_ADDRESS as `0x${string}`;
const GATE_TOKEN_MIN_BALANCE        = process.env.GATE_TOKEN_MIN_BALANCE ?? 1;
const GITHUB_TOKEN                  = process.env.GITHUB_TOKEN;
const REPO_CACHE_TTL_MS             = 5 * 60_000; // 5 min
const EVENT_CACHE_TTL_MS            = 10_000;
const DEFAULT_PAGE_SIZE             = 50;
const MAX_PAGE_SIZE                 = 200;
const SHOULD_RUN_INDEXER            = process.env.INDEXER === "1" || process.env.INDEXER?.toLowerCase() === "true";

// server can't start with these
if (!RIK_ADDRESS) die(new Error("RIK contract address is missing"));
if (!GATE_TOKEN_ADDRESS) die(new Error("gate token address is missing"));
if (!GITHUB_TOKEN) die(new Error("github token is missing"));

// address -> nonce (single-use)
// all address must be stored normalized in lower case here
const nonces = new Map<string, string>();

const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
});

const RepoRegisteredEvent = parseAbiItem("event RepoRegistered(uint256 indexed repoId, address indexed registrant, uint64 githubOwnerId, uint64 registeredAt)");

const app = fastify({ logger: true });

try { registerOrigins(ALLOWED_ORIGINS); } catch (err) { die(err); }

// Process-local L1 cache only. SQLite remains the durable layer so restarts do not
// immediately fan out to the RPC node and GitHub API again.
type Cache<T> = { value: T, at: number };
type RepoGithubCache = { metadata: RepoMetaData | null; ownerUsername: string | null };
type RepoPayload = {
    repoId: string;
    registrant: string;
    githubOwnerId: number;
    githubOwnerUsername: string;
    registeredAt: number;
    github: RepoMetaData | "not found";
};
type RepoStreamPayload = RepoPayload & { blockNumber: number };
type RepoWithMetaRow = RepoRow & Pick<GithubMetaRow, "full_name" | "description" | "language" | "stars" | "html_url" | "owner_name">;
type Sort = "registered_at_desc" | "stars_desc" | "registered_at_asc";

const repoCache = new Map<string, Cache<RepoGithubCache>>();
let eventCache: Cache<readonly any[]> | null = null;

const ORDER: Record<Sort, string> = {
    registered_at_asc:  "r.registered_at ASC, r.repo_id ASC",
    registered_at_desc: "r.registered_at DESC, r.repo_id DESC",
    stars_desc:         "m.stars IS NULL, m.stars DESC, r.registered_at DESC, r.repo_id DESC",
};

app.register(secureSession, {
    key: Buffer.from(SESSION_KEY),
    cookie: {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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

// augment module -> add address
declare module "@fastify/secure-session" {
    interface SessionData { address?: `0x${string}`; }
}

app.get("/api/repos", async (req, reply) => {
    const raw = req.query && typeof req.query === "object" ? req.query as Record<string, unknown> : {};
    const q = typeof raw.q === "string" ? raw.q.trim() : "";
    const sort = raw.sort ?? "registered_at_desc";
    if (typeof sort !== "string" || !(sort in ORDER)) throw httpErrors.badRequest("invalid sort");

    const limitRaw = Number(raw.limit ?? DEFAULT_PAGE_SIZE);
    const cursorRaw = Number(raw.cursor ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
    const offset = Number.isFinite(cursorRaw) ? Math.min(Math.max(Math.trunc(cursorRaw), 0), Number.MAX_SAFE_INTEGER) : 0;

    try {
        const now = Date.now();
        let logs: readonly any[];

        // RepoRegistered events are append-only for our purposes, so a short event
        // TTL collapses repeated page loads without hiding fresh data for long.
        if (eventCache && now - eventCache.at < EVENT_CACHE_TTL_MS) logs = eventCache.value;
        else {
            logs = await client.getLogs({ address: RIK_ADDRESS, event: RepoRegisteredEvent, fromBlock: await client.getBlockNumber() - DEFAULT_LIST_BLOCK_RANGE, toBlock: "latest" });
            eventCache = { value: logs, at: Date.now() };
        }

        for (const log of logs) {
            const { repoId, registrant, githubOwnerId, registeredAt } = log.args;
            if (repoId == null || registrant == null || githubOwnerId == null || registeredAt == null || log.blockNumber == null) continue;
            // Refreshes replay overlapping block ranges; repo_id is the stable event key,
            // so INSERT OR IGNORE makes the SQLite index idempotent.
            insertRepo.run(String(repoId), registrant, Number(githubOwnerId), Number(registeredAt), Number(log.blockNumber));
        }
    } catch (err) {
        // Once SQLite is primed, availability is better than failing the page because
        // the RPC endpoint had a transient outage. The next successful request repairs it.
        if ((listRepos.all() as RepoRow[]).length === 0) throw err;
        app.log.warn({ err }, "failed to refresh repo events; serving sqlite cache");
    }

    const where: string[] = [];
    const params: any[] = [];

    if (q) {
        const like = `%${q}%`;
        where.push(`(
            r.repo_id LIKE ? OR r.registrant LIKE ? OR CAST(r.github_owner_id AS TEXT) LIKE ? OR
            m.full_name LIKE ? OR m.description LIKE ? OR m.language LIKE ? OR m.owner_name LIKE ?
        )`);
        params.push(like, like, like, like, like, like, like);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = db.prepare(`
        SELECT r.repo_id, r.registrant, r.github_owner_id, r.registered_at, r.block_number,
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
            github: value.metadata ?? "not found",
        }
    }));
    return reply.type("application/json; charset=utf-8").send({ repos, nextCursor });
});

app.get("/", async () => ({
    name: APP_NAME,
    endpoints: ["/api/repos", "/api/auth/nonce", "/api/auth/verify"],
}));

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
            `SELECT r.repo_id, r.registrant, r.github_owner_id, r.registered_at, r.block_number,
                    m.full_name, m.description, m.language, m.stars, m.html_url, m.owner_name
             FROM repos r
             LEFT JOIN github_meta m ON m.repo_id = r.repo_id
             WHERE r.block_number > ?
             ORDER BY r.block_number`
        ).all(Number(lastId)) as RepoWithMetaRow[];
        
        for (const row of rows) {
            const payload = repoPayloadFromRow(row);
            reply.sse({ id: String(payload.blockNumber), data: JSON.stringify(payload) });
        }
    }
    const listener = (row: RepoStreamPayload) => reply.sse({ id: String(row.blockNumber), data: JSON.stringify(row) });
    registryEvents.on("repo", listener); req.raw.on("close", () => registryEvents.off("repo", listener));
});

// token gate-check every request
app.addHook("preHandler", async (req, _) => {
    // skip non-api routes + auth flow
    if (!req.url.startsWith("/api/")) return;
    if (req.url.startsWith("/api/auth/")) return;

    const address = req.session.get("address");
    if (!address) throw httpErrors.unauthorized("not signed in");
    if (!(await checkGate(address))) return httpErrors.unauthorized("insufficient $FREECODE balance");
});

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
    if (process.env.ALLOWED_ORIGINS && Array.isArray(parsed)) origins = origins.concat(parsed);
    for (const origin of origins) app.register(cors, {origin, credentials: true});
    return;
}

async function checkGate(address: `0x${string}`): Promise<boolean> {
    const balance = await client.readContract({
        address: GATE_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
    });
    return balance >= GATE_TOKEN_MIN_BALANCE;
}

function die(err: any): never {
    let error = "unknown error";
    if (err instanceof Error) error = err.message;
    console.error(`${APP_NAME}: ${error}; exiting.`);
    exit(1);
}

function repoPayloadFromRow(row: RepoWithMetaRow): RepoStreamPayload {
    return {
        repoId: row.repo_id,
        registrant: row.registrant,
        githubOwnerId: row.github_owner_id,
        githubOwnerUsername: row.owner_name ?? "not found",
        registeredAt: row.registered_at,
        blockNumber: row.block_number,
        github: row.full_name && row.html_url ? {
            fullName: row.full_name,
            description: row.description,
            language: row.language,
            stars: row.stars ?? 0,
            htmlUrl: row.html_url,
        } : "not found",
    };
}

if(!SHOULD_RUN_INDEXER) await app.listen({ port: 3000 });

export {client, RepoRegisteredEvent, RIK_ADDRESS, DEFAULT_LIST_BLOCK_RANGE};
