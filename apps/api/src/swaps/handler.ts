import { randomUUID } from "node:crypto";
import type {
    HexAddress,
    RequiredSwapAction,
    SwapApprovalResult,
    SwapBuildRequest,
    SwapJobError,
    SwapJobSnapshot,
    SwapJobStage,
    SwapProvider,
    SwapProviderError,
    SwapQuoteRequest,
    SwapQuoteResult,
    TransactionRequest,
} from "./types";

type WalletActionEvidence = Readonly<{
    permitSignature?: HexAddress;
    approvalTransactionHash?: HexAddress;
    approvalConfirmed?: true;
}>;

type QuotePendingWork = Readonly<{
    step: "quote_pending";
    wallet: WalletActionEvidence;
}>;

type ApprovalPendingWork = Readonly<{
    step: "approval_pending";
    quote: SwapQuoteResult;
    wallet: WalletActionEvidence;
}>;

type WalletActionPendingWork = Readonly<{
    step: "wallet_action_pending";
    quote: SwapQuoteResult;
    approval: SwapApprovalResult;
    requiredActions: readonly RequiredSwapAction[];
    wallet: WalletActionEvidence;
}>;

type BuildPendingWork = Readonly<{
    step: "build_pending";
    quote: SwapQuoteResult;
    approval: SwapApprovalResult;
    requiredActions: readonly RequiredSwapAction[];
    wallet: WalletActionEvidence;
}>;

type ReadyToSignWork = Readonly<{
    step: "ready_to_sign";
    quote: SwapQuoteResult;
    approval: SwapApprovalResult;
    requiredActions: readonly RequiredSwapAction[];
    transaction: TransactionRequest;
    result: unknown;
}>;

type FailedWork = Readonly<{
    step: "failed";
    error: SwapJobError;
    previous: SwapWork;
}>;

type RunnableWork = QuotePendingWork | ApprovalPendingWork | BuildPendingWork;
type SwapWork = RunnableWork | WalletActionPendingWork | ReadyToSignWork;

type SwapJobState =
    | Readonly<{ status: "queued"; work: RunnableWork }>
    | Readonly<{ status: "processing"; work: RunnableWork }>
    | Readonly<{ status: "action_required"; work: WalletActionPendingWork }>
    | Readonly<{ status: "completed"; work: ReadyToSignWork }>
    | Readonly<{ status: "failed"; work: FailedWork }>;

type SwapJob = {
    readonly id: string;
    readonly createdAt: number;
    readonly request: SwapQuoteRequest;
    updatedAt: number;
    attempts: number;
    state: SwapJobState;
};

export type SwapHandlerOptions = {
    maxBufferedJobs?: number;
    jobTtlMs?: number;
    maxAttempts?: number;
    retryBaseDelayMs?: number;
};

export type WalletActionInput = {
    permitSignature?: HexAddress;
    approvalTransactionHash?: HexAddress;
    approvalConfirmed?: boolean;
};

export type EnqueueSwapResult =
    | { ok: true; swap: SwapJobSnapshot }
    | { ok: false; error: "buffer_full" };

const DEFAULT_MAX_BUFFERED_JOBS = 250;
const DEFAULT_JOB_TTL_MS = 30 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

export class SwapHandler {
    readonly #provider: SwapProvider;
    readonly #jobs = new Map<string, SwapJob>();
    readonly #queue: string[] = [];
    readonly #maxBufferedJobs: number;
    readonly #jobTtlMs: number;
    readonly #maxAttempts: number;
    readonly #retryBaseDelayMs: number;
    #running = false;

    constructor(provider: SwapProvider, options: SwapHandlerOptions = {}) {
        this.#provider = provider;
        this.#maxBufferedJobs = options.maxBufferedJobs ?? DEFAULT_MAX_BUFFERED_JOBS;
        this.#jobTtlMs = options.jobTtlMs ?? DEFAULT_JOB_TTL_MS;
        this.#maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        this.#retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    }

    enqueue(request: SwapQuoteRequest): EnqueueSwapResult {
        this.#prune();
        if (this.#jobs.size >= this.#maxBufferedJobs) return { ok: false, error: "buffer_full" };

        const now = Date.now();
        const job: SwapJob = {
            id: randomUUID(),
            createdAt: now,
            updatedAt: now,
            attempts: 0,
            request,
            state: {
                status: "queued",
                work: { step: "quote_pending", wallet: {} },
            },
        };

        this.#jobs.set(job.id, job);
        this.#queue.push(job.id);
        this.#consumeSoon();

        return { ok: true, swap: this.#snapshot(job) };
    }

    get(id: string): SwapJobSnapshot | null {
        const job = this.#jobs.get(id);
        return job ? this.#snapshot(job) : null;
    }

    receiveWalletAction(id: string, input: WalletActionInput): SwapJobSnapshot | null {
        const job = this.#jobs.get(id);
        if (!job) return null;
        if (job.state.status !== "action_required") return this.#snapshot(job);

        const wallet = mergeWalletEvidence(job.state.work.wallet, input);
        const requiredActions = requiredActionsFor(job.state.work.quote, job.state.work.approval, wallet);

        if (requiredActions.every((action) => action.fulfilled)) {
            this.#transition(job, {
                status: "queued",
                work: {
                    step: "build_pending",
                    quote: job.state.work.quote,
                    approval: job.state.work.approval,
                    requiredActions,
                    wallet,
                },
            });
            this.#queue.push(job.id);
            this.#consumeSoon();
        } else {
            this.#transition(job, {
                status: "action_required",
                work: {
                    step: "wallet_action_pending",
                    quote: job.state.work.quote,
                    approval: job.state.work.approval,
                    requiredActions,
                    wallet,
                },
            });
        }

        return this.#snapshot(job);
    }

    async getSwapStatus(chainId: number, txHashes: HexAddress[]): Promise<unknown> {
        if (!this.#provider.getSwapStatus) throw new Error("swap status is not supported by this provider");
        return await this.#provider.getSwapStatus({ chainId, txHashes });
    }

    #consumeSoon(): void {
        if (this.#running) return;
        queueMicrotask(() => void this.#consume());
    }

    async #consume(): Promise<void> {
        if (this.#running) return;
        this.#running = true;
        try {
            while (this.#queue.length > 0) {
                const id = this.#queue.shift();
                if (!id) continue;

                const job = this.#jobs.get(id);
                if (!job || job.state.status !== "queued") continue;

                await this.#run(job);
            }
        } finally {
            this.#running = false;
            if (this.#queue.length > 0) this.#consumeSoon();
        }
    }

    async #run(job: SwapJob): Promise<void> {
        if (job.state.status !== "queued") return;
        const work = job.state.work;
        this.#transition(job, { status: "processing", work });
        job.attempts += 1;

        try {
            const ready = await this.#prepareBuild(job, work);
            if (ready.step === "wallet_action_pending") {
                this.#transition(job, { status: "action_required", work: ready });
                return;
            }

            const result = await this.#buildSwap(job, ready);
            this.#transition(job, { status: "completed", work: result });
        } catch (err) {
            this.#transition(job, {
                status: "failed",
                work: {
                    step: "failed",
                    error: normalizeSwapError(err),
                    previous: previousWorkForFailure(job.state),
                },
            });
        }
    }

    async #prepareBuild(job: SwapJob, initial: RunnableWork): Promise<BuildPendingWork | WalletActionPendingWork> {
        const approvalWork = await this.#advanceToApproval(job, initial);
        const buildWork = await this.#advanceToBuild(job, approvalWork);

        if (buildWork.requiredActions.some((action) => !action.fulfilled)) {
            return {
                step: "wallet_action_pending",
                quote: buildWork.quote,
                approval: buildWork.approval,
                requiredActions: buildWork.requiredActions,
                wallet: buildWork.wallet,
            };
        }

        return buildWork;
    }

    async #advanceToApproval(job: SwapJob, work: RunnableWork): Promise<ApprovalPendingWork | BuildPendingWork> {
        switch (work.step) {
            case "quote_pending": {
                const quote = await this.#callProvider(() => this.#provider.quote(job.request));
                const next: ApprovalPendingWork = { step: "approval_pending", quote, wallet: work.wallet };
                this.#transition(job, { status: "processing", work: next });
                return next;
            }
            case "approval_pending":
            case "build_pending":
                this.#transition(job, { status: "processing", work });
                return work;
            default:
                return assertNever(work);
        }
    }

    async #advanceToBuild(job: SwapJob, work: ApprovalPendingWork | BuildPendingWork): Promise<BuildPendingWork> {
        switch (work.step) {
            case "approval_pending": {
                const approval = await this.#callProvider(() => this.#provider.checkApproval({
                    chainId: job.request.chainId,
                    walletAddress: job.request.swapper,
                    token: job.request.tokenIn,
                    amount: readQuoteInputAmount(work.quote.quote) ?? job.request.amount,
                }));
                const requiredActions = requiredActionsFor(work.quote, approval, work.wallet);
                const next: BuildPendingWork = {
                    step: "build_pending",
                    quote: work.quote,
                    approval,
                    requiredActions,
                    wallet: work.wallet,
                };
                this.#transition(job, { status: "processing", work: next });
                return next;
            }
            case "build_pending":
                this.#transition(job, { status: "processing", work });
                return work;
            default:
                return assertNever(work);
        }
    }

    async #buildSwap(job: SwapJob, work: BuildPendingWork): Promise<ReadyToSignWork> {
        const request = buildRequest(work);
        const result = await this.#callProvider(() => this.#provider.buildSwap(request));
        validateTransaction(result.transaction);

        return {
            step: "ready_to_sign",
            quote: work.quote,
            approval: work.approval,
            requiredActions: work.requiredActions,
            transaction: result.transaction,
            result: result.raw,
        };
    }

    async #callProvider<T>(fn: () => Promise<T>): Promise<T> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= this.#maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                if (!isRetriable(err) || attempt === this.#maxAttempts) break;
                await sleep(this.#retryBaseDelayMs * 2 ** (attempt - 1));
            }
        }

        throw lastError;
    }

    #transition(job: SwapJob, state: SwapJobState): void {
        job.state = state;
        job.updatedAt = Date.now();
    }

    #snapshot(job: SwapJob): SwapJobSnapshot {
        const snapshot: SwapJobSnapshot = {
            id: job.id,
            status: job.state.status,
            stage: stageOf(job.state),
            createdAt: new Date(job.createdAt).toISOString(),
            updatedAt: new Date(job.updatedAt).toISOString(),
            attempts: job.attempts,
            request: job.request,
            requiredActions: requiredActionsOf(job.state),
        };

        const quote = quoteOf(job.state);
        const approval = approvalOf(job.state);
        if (quote) snapshot.quote = quote;
        if (approval) snapshot.approval = approval;

        switch (job.state.status) {
            case "queued":
            case "processing":
            case "action_required":
                break;
            case "completed":
                snapshot.transaction = job.state.work.transaction;
                snapshot.result = job.state.work.result;
                break;
            case "failed":
                snapshot.error = job.state.work.error;
                break;
            default:
                assertNever(job.state);
        }

        return snapshot;
    }

    #prune(): void {
        const expiresBefore = Date.now() - this.#jobTtlMs;
        for (const [id, job] of this.#jobs) {
            if (job.updatedAt < expiresBefore) this.#jobs.delete(id);
        }
    }
}

function mergeWalletEvidence(current: WalletActionEvidence, input: WalletActionInput): WalletActionEvidence {
    const next: {
        permitSignature?: HexAddress;
        approvalTransactionHash?: HexAddress;
        approvalConfirmed?: true;
    } = { ...current };

    if (input.permitSignature) next.permitSignature = input.permitSignature;
    if (input.approvalTransactionHash) {
        next.approvalTransactionHash = input.approvalTransactionHash;
        next.approvalConfirmed = true;
    }
    if (input.approvalConfirmed === true) next.approvalConfirmed = true;

    return next;
}

function requiredActionsFor(quote: SwapQuoteResult, approval: SwapApprovalResult, wallet: WalletActionEvidence): readonly RequiredSwapAction[] {
    const actions: RequiredSwapAction[] = [];
    if (approval.approval || approval.cancel) {
        const action: RequiredSwapAction = {
            type: "approval",
            approval: approval.approval,
            cancel: approval.cancel,
            fulfilled: wallet.approvalConfirmed === true,
        };
        if (wallet.approvalTransactionHash) action.transactionHash = wallet.approvalTransactionHash;
        actions.push(action);
    }

    if (quote.permitData) {
        actions.push({
            type: "permit",
            permitData: quote.permitData,
            fulfilled: Boolean(wallet.permitSignature),
        });
    }

    return actions;
}

function buildRequest(work: BuildPendingWork): SwapBuildRequest {
    return {
        quote: work.quote.quote,
        permitData: work.quote.permitData,
        signature: work.wallet.permitSignature ?? null,
    };
}

function validateTransaction(transaction: TransactionRequest): void {
    if (!transaction.to) throw new Error("swap transaction is missing recipient");
    if (!transaction.from) throw new Error("swap transaction is missing sender");
    if (!transaction.data || transaction.data === "0x") throw new Error("swap transaction is missing calldata");
}

function stageOf(state: SwapJobState): SwapJobStage {
    switch (state.status) {
        case "queued":
            return "queued";
        case "action_required":
            return "awaiting_wallet_action";
        case "completed":
            return "ready_to_sign";
        case "failed":
            return "failed";
        case "processing":
            return stageOfRunnableWork(state.work);
        default:
            return assertNever(state);
    }
}

function stageOfRunnableWork(work: RunnableWork): SwapJobStage {
    switch (work.step) {
        case "quote_pending":
            return "quoting";
        case "approval_pending":
            return "checking_approval";
        case "build_pending":
            return "building_swap";
        default:
            return assertNever(work);
    }
}

function requiredActionsOf(state: SwapJobState): readonly RequiredSwapAction[] {
    switch (state.status) {
        case "queued":
        case "processing":
            return state.work.step === "build_pending" ? state.work.requiredActions : [];
        case "action_required":
        case "completed":
            return state.work.requiredActions;
        case "failed":
            return requiredActionsOfWork(state.work.previous);
        default:
            return assertNever(state);
    }
}

function requiredActionsOfWork(work: SwapWork): readonly RequiredSwapAction[] {
    switch (work.step) {
        case "quote_pending":
        case "approval_pending":
            return [];
        case "build_pending":
        case "wallet_action_pending":
        case "ready_to_sign":
            return work.requiredActions;
        default:
            return assertNever(work);
    }
}

function previousWorkForFailure(state: SwapJobState): SwapWork {
    switch (state.status) {
        case "queued":
        case "processing":
        case "action_required":
        case "completed":
            return state.work;
        case "failed":
            return state.work.previous;
        default:
            return assertNever(state);
    }
}

function quoteOf(state: SwapJobState): SwapQuoteResult | null {
    switch (state.status) {
        case "queued":
        case "processing":
            return state.work.step === "quote_pending" ? null : state.work.quote;
        case "action_required":
        case "completed":
            return state.work.quote;
        case "failed":
            return quoteOfWork(state.work.previous);
        default:
            return assertNever(state);
    }
}

function quoteOfWork(work: SwapWork): SwapQuoteResult | null {
    switch (work.step) {
        case "quote_pending":
            return null;
        case "approval_pending":
        case "build_pending":
        case "wallet_action_pending":
        case "ready_to_sign":
            return work.quote;
        default:
            return assertNever(work);
    }
}

function approvalOf(state: SwapJobState): SwapApprovalResult | null {
    switch (state.status) {
        case "queued":
        case "processing":
            return state.work.step === "build_pending" ? state.work.approval : null;
        case "action_required":
        case "completed":
            return state.work.approval;
        case "failed":
            return approvalOfWork(state.work.previous);
        default:
            return assertNever(state);
    }
}

function approvalOfWork(work: SwapWork): SwapApprovalResult | null {
    switch (work.step) {
        case "quote_pending":
        case "approval_pending":
            return null;
        case "build_pending":
        case "wallet_action_pending":
        case "ready_to_sign":
            return work.approval;
        default:
            return assertNever(work);
    }
}

function normalizeSwapError(err: unknown): SwapJobError {
    if (err instanceof Error && "code" in err && "retriable" in err) {
        const providerError = err as SwapProviderError;
        const swapError: SwapJobError = {
            code: providerError.code,
            message: providerError.message,
            retriable: providerError.retriable,
        };
        if (providerError.details !== undefined) swapError.details = providerError.details;
        return swapError;
    }

    return {
        code: "swap_failed",
        message: err instanceof Error ? err.message : "swap failed",
        retriable: false,
    };
}

function isRetriable(err: unknown): boolean {
    return err instanceof Error && "retriable" in err && Boolean((err as SwapProviderError).retriable);
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

function readQuoteInputAmount(value: unknown): string | null {
    if (!isRecord(value)) return null;
    const input = value.input;
    if (!isRecord(input)) return null;
    return typeof input.amount === "string" && input.amount ? input.amount : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function assertNever(value: never): never {
    throw new Error(`unhandled swap state: ${JSON.stringify(value)}`);
}
