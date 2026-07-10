import { describe, expect, it } from "vitest";
import { SwapHandler } from "./handler";
import type { HexAddress, SwapProvider, SwapQuoteRequest, TransactionRequest } from "./types";

const ACCOUNT = "0x0000000000000000000000000000000000000001" as const;
const TOKEN_IN = "0x0000000000000000000000000000000000000002" as const;
const TOKEN_OUT = "0x0000000000000000000000000000000000000003" as const;
const ROUTER = "0x0000000000000000000000000000000000000004" as const;
const SIGNATURE = "0x1234" as HexAddress;
const TX_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

describe("SwapHandler", () => {
    it("builds a wallet-signable transaction when no wallet action is required", async () => {
        const transaction = tx({ to: ROUTER, from: ACCOUNT, data: "0xabcd" });
        const provider = providerStub({ transaction });
        const handler = new SwapHandler(provider);

        const queued = expectEnqueued(handler.enqueue(swapRequest()));
        await waitForSwap(handler, queued.id, "completed");

        const completed = handler.get(queued.id);
        expect(completed?.stage).toBe("ready_to_sign");
        expect(completed?.transaction).toEqual(transaction);
        expect(completed?.requiredActions).toEqual([]);
    });

    it("pauses for wallet approval and Permit2 signature, then resumes", async () => {
        const approval = tx({ to: TOKEN_IN, from: ACCOUNT, data: "0x095ea7b3" });
        const transaction = tx({ to: ROUTER, from: ACCOUNT, data: "0xbeef" });
        const provider = providerStub({
            approval,
            permitData: { domain: { name: "Permit2" }, values: { spender: ROUTER } },
            transaction,
        });
        const handler = new SwapHandler(provider);

        const queued = expectEnqueued(handler.enqueue(swapRequest()));
        const actionRequired = await waitForSwap(handler, queued.id, "action_required");

        expect(actionRequired.requiredActions.map((action) => action.type)).toEqual(["approval", "permit"]);

        handler.receiveWalletAction(queued.id, {
            approvalTransactionHash: TX_HASH,
            permitSignature: SIGNATURE,
        });
        const completed = await waitForSwap(handler, queued.id, "completed");

        expect(completed.stage).toBe("ready_to_sign");
        expect(completed.transaction).toEqual(transaction);
        expect(completed.requiredActions.every((action) => action.fulfilled)).toBe(true);
    });

    it("records smooth failure state instead of throwing out of the worker", async () => {
        const provider = providerStub({ throwOnQuote: true });
        const handler = new SwapHandler(provider, { maxAttempts: 1 });

        const queued = expectEnqueued(handler.enqueue(swapRequest()));
        const failed = await waitForSwap(handler, queued.id, "failed");

        expect(failed.stage).toBe("failed");
        expect(failed.error?.code).toBe("quote_failed");
        expect(failed.error?.message).toBe("quote failed");
    });

    it("returns a typed buffer-full result instead of throwing", () => {
        const provider = providerStub({});
        const handler = new SwapHandler(provider, { maxBufferedJobs: 1 });

        expect(handler.enqueue(swapRequest()).ok).toBe(true);
        expect(handler.enqueue(swapRequest())).toEqual({ ok: false, error: "buffer_full" });
    });
});

function providerStub(options: {
    approval?: TransactionRequest;
    permitData?: unknown;
    transaction?: TransactionRequest;
    throwOnQuote?: boolean;
}): SwapProvider {
    return {
        async checkApproval() {
            return { approval: options.approval ?? null, cancel: null, raw: {} };
        },
        async quote() {
            if (options.throwOnQuote) throw Object.assign(new Error("quote failed"), { code: "quote_failed", retriable: false });
            return {
                quote: { quoteId: "quote-1" },
                permitData: options.permitData ?? null,
                routing: "CLASSIC",
                raw: {},
            };
        },
        async buildSwap(request) {
            if (options.permitData && !request.signature) throw new Error("signature missing");
            return { transaction: options.transaction ?? tx({ to: ROUTER, from: ACCOUNT, data: "0xabcd" }), raw: {} };
        },
    };
}

function swapRequest(): SwapQuoteRequest {
    return {
        chainId: 84532,
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amount: "1000000",
        swapper: ACCOUNT,
        type: "EXACT_INPUT",
        slippageTolerance: 0.5,
        permitAmount: "FULL",
        routingPreference: "BEST_PRICE",
    };
}

function tx(input: { to: HexAddress; from: HexAddress; data: HexAddress }): TransactionRequest {
    return {
        to: input.to,
        from: input.from,
        data: input.data,
        value: "0",
        chainId: 84532,
    };
}

async function waitForSwap(handler: SwapHandler, id: string, status: "action_required" | "completed" | "failed") {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const swap = handler.get(id);
        if (swap?.status === status) return swap;
        await wait(10);
    }

    throw new Error(`swap did not reach ${status}`);
}

async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

function expectEnqueued(result: ReturnType<SwapHandler["enqueue"]>) {
    if (!result.ok) throw new Error(`expected swap to enqueue, got ${result.error}`);
    return result.swap;
}
