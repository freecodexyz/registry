import fastify from "fastify";
import { exit } from "node:process";
import cors from "@fastify/cors";
import { createPublicClient, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";

const APP_NAME = "registry-api";
const RIK_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_LIST_BLOCK_RANGE = 50_000n;
const ALLOWED_ORIGINS = ["http://localhost:5173"];

if (!RIK_ADDRESS) die(new Error("RIK contract address is not defined"));

const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
});

const RepoRegisteredEvent = parseAbiItem("event RepoRegistered(uint256 indexed repoId, address indexed registrant, uint64 githubOwnerId, uint64 registeredAt)");

const app = fastify({ logger: true });

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
    endpoints: ["/api/repos"],
}));

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

function die(err: any): never {
    let error = "unknown error";
    if (err instanceof Error) error = err.message;
    console.error(`${APP_NAME}: ${error}; exiting.`);
    exit(1);
}


try { registerOrigins(ALLOWED_ORIGINS); } catch (err) { die(err); }
await app.listen({ port: 3000 });
