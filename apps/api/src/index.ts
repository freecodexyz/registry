import fastify from "fastify";
import { exit } from "node:process";
import { createPublicClient, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";

const APP_NAME = "registry-api";
const RIK_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL = process.env.RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const DEFAULT_LIST_BLOCK_RANGE = 50_000n;

if (!RIK_ADDRESS) die(new Error("RIK contract address is not defined"));

const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
});

const RepoRegisteredEvent = parseAbiItem("event RepoRegistered(uint256 indexed repoId, address indexed registrant, uint64 githubOwnerId, uint64 registeredAt)");

const app = fastify({ logger: true });

app.get("/", async (_request, reply) => {
    const logs = await client.getLogs({ address: RIK_ADDRESS, event: RepoRegisteredEvent, fromBlock: await client.getBlockNumber() - DEFAULT_LIST_BLOCK_RANGE, toBlock: "latest" });
    const rows = logs.map((l) => {
        const a = l.args;
        return `<tr>
            <td>${a.repoId}</td>
            <td>${a.registrant}</td>
            <td>${a.githubOwnerId}</td>
            <td>${a.registeredAt}</td>
        </tr>`;
    }).join("\n");

    return reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RIK Registry</title>
    <style>
        table { border-collapse: collapse; }
        th, td { border: 1px solid #999; padding: 0.25rem 0.5rem; }
    </style>
</head>
<body>
    <h1>RIK Registry</h1>
    <table>
        <thead>
            <tr>
                <th>repoId</th>
                <th>registrant</th>
                <th>ownerId</th>
                <th>registeredAt</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
</body>
</html>`);
});

function die(err: any): never {
    let error = "unknown error";
    if (err instanceof Error) error = err.message;
    console.error(`${APP_NAME}: ${error}; exiting.`);
    exit(1);
}

await app.listen({ port: 3000 });
