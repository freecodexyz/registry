import type { AbiEvent, GetLogsParameters, GetLogsReturnType } from "viem";

type GetLogsRange = {
    fromBlock: bigint;
    toBlock: bigint;
};

type LogsClient = {
    getLogs(parameters: GetLogsParameters): Promise<readonly unknown[]>;
};

type Sleep = (ms: number) => Promise<void>;

export type RateLimitRetry = {
    readonly attempt: number;
    readonly delayMs: number;
    readonly fromBlock: bigint;
    readonly toBlock: bigint;
    readonly error: unknown;
};

export type LogsFetcherOptions = {
    readonly rateLimitBaseDelayMs?: number;
    readonly rateLimitMaxDelayMs?: number;
    readonly rateLimitMaxRetries?: number;
    readonly sleep?: Sleep;
    readonly onRateLimitRetry?: (retry: RateLimitRetry) => void;
};

const DEFAULT_RATE_LIMIT_BASE_DELAY_MS = 1_000;
const DEFAULT_RATE_LIMIT_MAX_DELAY_MS = 30_000;

export class LogsFetcher {
    private currentChunkRange: bigint;
    private readonly rateLimitBaseDelayMs: number;
    private readonly rateLimitMaxDelayMs: number;
    private readonly rateLimitMaxRetries: number;
    private readonly sleep: Sleep;
    private readonly onRateLimitRetry: ((retry: RateLimitRetry) => void) | undefined;

    constructor(
        private readonly client: LogsClient,
        private readonly maxLogRange: bigint,
        options: LogsFetcherOptions = {},
    ) {
        if (maxLogRange < 1n) throw new Error("maxLogRange must be at least 1 block");
        this.currentChunkRange = maxLogRange;
        this.rateLimitBaseDelayMs = readPositiveFiniteNumber(
            options.rateLimitBaseDelayMs,
            DEFAULT_RATE_LIMIT_BASE_DELAY_MS,
            "rateLimitBaseDelayMs",
        );
        this.rateLimitMaxDelayMs = readPositiveFiniteNumber(
            options.rateLimitMaxDelayMs,
            DEFAULT_RATE_LIMIT_MAX_DELAY_MS,
            "rateLimitMaxDelayMs",
        );
        this.rateLimitMaxRetries = readNonNegativeRetryLimit(options.rateLimitMaxRetries);
        this.sleep = options.sleep ?? sleep;
        this.onRateLimitRetry = options.onRateLimitRetry;
    }

    async getLogs<
        abiEvent extends AbiEvent | undefined = undefined,
        abiEvents extends readonly AbiEvent[] | readonly unknown[] | undefined = abiEvent extends AbiEvent ? [abiEvent] : undefined,
        strict extends boolean | undefined = undefined,
    >(
        parameters: GetLogsParameters<abiEvent, abiEvents, strict, bigint, bigint> & GetLogsRange,
    ): Promise<GetLogsReturnType<abiEvent, abiEvents, strict, bigint, bigint>> {
        const { fromBlock, toBlock } = parameters;
        const logs: GetLogsReturnType<abiEvent, abiEvents, strict, bigint, bigint> = [];
        if (fromBlock > toBlock) return logs;

        let cursor = fromBlock;
        let reducedRange = false;
        let rateLimitRetries = 0;

        while (cursor <= toBlock) {
            const chunkRange = this.currentChunkRange;
            const chunkEnd = cursor + chunkRange - 1n;
            const chunkToBlock = chunkEnd < toBlock ? chunkEnd : toBlock;

            try {
                const chunkLogs = await this.client.getLogs({
                    ...parameters,
                    fromBlock: cursor,
                    toBlock: chunkToBlock,
                } as GetLogsParameters);

                logs.push(...(chunkLogs as GetLogsReturnType<abiEvent, abiEvents, strict, bigint, bigint>));
                cursor = chunkToBlock + 1n;
                rateLimitRetries = 0;
            } catch (error) {
                if (isRateLimitError(error)) {
                    if (rateLimitRetries >= this.rateLimitMaxRetries) throw error;

                    rateLimitRetries += 1;
                    const delayMs = this.rateLimitDelayMs(error, rateLimitRetries);
                    this.onRateLimitRetry?.({
                        attempt: rateLimitRetries,
                        delayMs,
                        fromBlock: cursor,
                        toBlock: chunkToBlock,
                        error,
                    });
                    await this.sleep(delayMs);
                    continue;
                }

                if (chunkRange === 1n) throw error;

                this.currentChunkRange = chunkRange / 2n;
                reducedRange = true;
            }
        }

        if (!reducedRange) {
            const grownRange = this.currentChunkRange * 2n;
            this.currentChunkRange = grownRange < this.maxLogRange ? grownRange : this.maxLogRange;
        }

        return logs;
    }

    private rateLimitDelayMs(error: unknown, attempt: number): number {
        const retryAfterDelay = retryAfterDelayMs(error);
        if (retryAfterDelay !== null) return retryAfterDelay;

        return Math.min(this.rateLimitBaseDelayMs * 2 ** (attempt - 1), this.rateLimitMaxDelayMs);
    }
}

function readPositiveFiniteNumber(value: number | undefined, fallback: number, name: string): number {
    if (value === undefined) return fallback;
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
    return value;
}

function readNonNegativeRetryLimit(value: number | undefined): number {
    if (value === undefined) return Number.POSITIVE_INFINITY;
    if (value === Number.POSITIVE_INFINITY) return value;
    if (!Number.isInteger(value) || value < 0) throw new Error("rateLimitMaxRetries must be a non-negative integer");
    return value;
}

function isRateLimitError(error: unknown): boolean {
    return statusCodeOf(error) === 429;
}

function statusCodeOf(value: unknown, depth = 0): number | null {
    if (depth > 4 || !isRecord(value)) return null;

    const status = value.status;
    if (typeof status === "number") return status;

    const responseStatus = statusCodeOf(value.response, depth + 1);
    if (responseStatus !== null) return responseStatus;

    return statusCodeOf(value.cause, depth + 1);
}

function retryAfterDelayMs(error: unknown): number | null {
    const retryAfter = retryAfterHeader(error);
    if (retryAfter === null) return null;

    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

    const dateMs = Date.parse(retryAfter);
    if (Number.isNaN(dateMs)) return null;

    return Math.max(dateMs - Date.now(), 0);
}

function retryAfterHeader(value: unknown, depth = 0): string | null {
    if (depth > 4 || !isRecord(value)) return null;

    const headers = value.headers;
    const retryAfter = readRetryAfterHeader(headers);
    if (retryAfter !== null) return retryAfter;

    const responseRetryAfter = retryAfterHeader(value.response, depth + 1);
    if (responseRetryAfter !== null) return responseRetryAfter;

    return retryAfterHeader(value.cause, depth + 1);
}

function readRetryAfterHeader(headers: unknown): string | null {
    if (!isRecord(headers)) return null;

    const get = headers.get;
    if (typeof get !== "function") return null;

    const retryAfter = get.call(headers, "retry-after");
    return typeof retryAfter === "string" ? retryAfter : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
