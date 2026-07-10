import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import { httpErrors } from "@fastify/sensible";
import { isAddress } from "viem";
import type { SwapHandler, WalletActionInput } from "./handler";
import type { TradableAssetRegistry } from "./assets";
import type { HexAddress, SwapQuoteRequest, SwapTradeType } from "./types";

type RegisterTradeRoutesOptions = {
    chainId: number;
    handler: SwapHandler;
    assets: TradableAssetRegistry;
    preHandler?: preHandlerHookHandler;
};

type SwapParams = {
    id: string;
};

export function registerTradeRoutes(app: FastifyInstance, options: RegisterTradeRoutesOptions): void {
    const routeOptions = options.preHandler ? { preHandler: options.preHandler } : {};

    app.get("/api/trade/assets", routeOptions, async () => {
        return {
            chainId: options.chainId,
            assets: await options.assets.list(),
        };
    });

    app.post<{ Body: unknown }>("/api/trade/swaps", routeOptions, async (req, reply) => {
        const body = readBody(req.body);
        const swapRequest = await readSwapRequest(body, options);
        const result = options.handler.enqueue(swapRequest);
        if (!result.ok) throw httpErrors.serviceUnavailable("swap buffer is full");
        return reply.code(202).send({ swap: result.swap });
    });

    app.get<{ Params: SwapParams }>("/api/trade/swaps/:id", routeOptions, async (req) => {
        const swap = options.handler.get(req.params.id);
        if (!swap) throw httpErrors.notFound("swap not found");
        return { swap };
    });

    app.post<{ Params: SwapParams; Body: unknown }>("/api/trade/swaps/:id/actions", routeOptions, async (req, reply) => {
        const body = readBody(req.body);
        const actionInput: WalletActionInput = {};
        const permitSignature = readOptionalHex(body.permitSignature, "permitSignature");
        const approvalTransactionHash = readOptionalHex(body.approvalTransactionHash, "approvalTransactionHash");
        if (permitSignature) actionInput.permitSignature = permitSignature;
        if (approvalTransactionHash) actionInput.approvalTransactionHash = approvalTransactionHash;
        if (body.approvalConfirmed === true) actionInput.approvalConfirmed = true;

        const swap = options.handler.receiveWalletAction(req.params.id, actionInput);

        if (!swap) throw httpErrors.notFound("swap not found");
        return reply.code(swap.status === "queued" ? 202 : 200).send({ swap });
    });

    app.get<{ Querystring: { chainId?: number | string; txHashes?: string } }>("/api/trade/swaps/status", routeOptions, async (req) => {
        const chainId = readOptionalChainId(req.query.chainId, options.chainId);
        const txHashes = readTxHashes(req.query.txHashes);
        return {
            chainId,
            status: await options.handler.getSwapStatus(chainId, txHashes),
        };
    });
}

async function readSwapRequest(body: Record<string, unknown>, options: RegisterTradeRoutesOptions): Promise<SwapQuoteRequest> {
    const chainId = readOptionalChainId(body.chainId, options.chainId);
    const tokenIn = readAddress(body.tokenIn, "tokenIn");
    const tokenOut = readAddress(body.tokenOut, "tokenOut");
    if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) throw httpErrors.badRequest("tokenIn and tokenOut must differ");
    if (!(await options.assets.isTradable(tokenIn))) throw httpErrors.badRequest("tokenIn is not tradable");
    if (!(await options.assets.isTradable(tokenOut))) throw httpErrors.badRequest("tokenOut is not tradable");

    return {
        chainId,
        tokenIn,
        tokenOut,
        amount: readAmount(body.amount),
        swapper: readAddress(body.swapper, "swapper"),
        type: readTradeType(body.type),
        slippageTolerance: readSlippageTolerance(body.slippageTolerance),
        permitAmount: body.permitAmount === "EXACT" ? "EXACT" : "FULL",
        routingPreference: body.routingPreference === "FASTEST" ? "FASTEST" : "BEST_PRICE",
    };
}

function readBody(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw httpErrors.badRequest("request body must be an object");
    return body as Record<string, unknown>;
}

function readOptionalChainId(value: unknown, expectedChainId: number): number {
    if (value === undefined || value === null || value === "") return expectedChainId;
    const chainId = Number(value);
    if (!Number.isInteger(chainId) || chainId !== expectedChainId) throw httpErrors.badRequest(`chainId must be ${expectedChainId}`);
    return chainId;
}

function readAddress(value: unknown, name: string): HexAddress {
    if (typeof value !== "string" || !value) throw httpErrors.badRequest(`${name} is required`);
    if (!isAddress(value)) throw httpErrors.badRequest(`${name} must be a valid address`);
    return value as HexAddress;
}

function readAmount(value: unknown): string {
    if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) throw httpErrors.badRequest("amount must be a positive integer string in token base units");
    return value;
}

function readTradeType(value: unknown): SwapTradeType {
    if (value === undefined || value === null || value === "") return "EXACT_INPUT";
    if (value !== "EXACT_INPUT" && value !== "EXACT_OUTPUT") throw httpErrors.badRequest("type must be EXACT_INPUT or EXACT_OUTPUT");
    return value;
}

function readSlippageTolerance(value: unknown): number {
    if (value === undefined || value === null || value === "") return 0.5;
    const slippage = Number(value);
    if (!Number.isFinite(slippage) || slippage < 0.01 || slippage > 50) throw httpErrors.badRequest("slippageTolerance must be between 0.01 and 50");
    return slippage;
}

function readOptionalHex(value: unknown, name: string): HexAddress | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || !value.startsWith("0x")) throw httpErrors.badRequest(`${name} must be a hex string`);
    return value as HexAddress;
}

function readTxHashes(value: unknown): HexAddress[] {
    if (typeof value !== "string" || !value) throw httpErrors.badRequest("txHashes is required");
    const txHashes = value.split(",").map((hash) => hash.trim()).filter(Boolean);
    if (txHashes.length === 0) throw httpErrors.badRequest("txHashes is required");
    if (txHashes.some((hash) => !/^0x[0-9a-fA-F]{64}$/.test(hash))) throw httpErrors.badRequest("txHashes must be comma-separated transaction hashes");
    return txHashes as HexAddress[];
}
