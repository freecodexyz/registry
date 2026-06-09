import fastify from "fastify";
import { exit } from "node:process";
import cors from "@fastify/cors";
import { createPublicClient, http, isAddress, parseAbiItem, erc20Abi } from "viem";
import { sepolia } from "viem/chains";
import { httpErrors } from "@fastify/sensible";
import { generateNonce, SiweMessage } from "siwe";
import secureSession from "@fastify/secure-session";
import { randomBytes } from 'node:crypto'

const APP_NAME                      = "registry-api";
const RIK_ADDRESS                   = process.env.CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL                       = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_LIST_BLOCK_RANGE      = 50_000n;
const ALLOWED_ORIGINS               = ["http://localhost:5173"];
const SIWE_DOMAIN                   = process.env.SIWE_DOMAIN ?? "localhost:5173";
const SESSION_KEY                   = process.env.SESSION_KEY ?? randomBytes(32);
const GATE_TOKEN_ADDRESS            = process.env.GATE_TOKEN_ADDRESS as `0x${string}`;
const GATE_TOKEN_MIN_BALANCE        = process.env.GATE_TOKEN_MIN_BALANCE ?? 1;

// server can't start with these
if (!RIK_ADDRESS) die(new Error("RIK contract address is missing"));
if (!GATE_TOKEN_ADDRESS) die(new Error("gate token address is missing"));

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

// augment module -> add address
declare module "@fastify/secure-session" {
    interface SessionData { address?: `0x${string}`; }
}

app.get("/api/repos", async (_request, reply) => {
    const logs = await client.getLogs({ address: RIK_ADDRESS, event: RepoRegisteredEvent, fromBlock: await client.getBlockNumber() - DEFAULT_LIST_BLOCK_RANGE, toBlock: "latest" });
    return reply.type("application/json; charset=utf-8").send(logs.map((l) => ({
        repoId:         String(l.args.repoId),
        registrant:     l.args.registrant,
        githubOwnerId:  Number(l.args.githubOwnerId),
        registeredAt:   Number(l.args.registeredAt),
    })))
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

await app.listen({ port: 3000 });
