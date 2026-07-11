import type { GetLogsParameters } from "viem";
import { describe, expect, it } from "vitest";
import { LogsFetcher } from "./fetch-logs";

const ADDRESS = "0x0000000000000000000000000000000000000001" as const;

describe("LogsFetcher", () => {
    it("backs off and retries 429 rate limits without shrinking single-block chunks", async () => {
        const calls: [bigint | undefined, bigint | undefined][] = [];
        const delays: number[] = [];
        const retries: number[] = [];
        let attempts = 0;

        const fetcher = new LogsFetcher({
            async getLogs(parameters) {
                calls.push(readRange(parameters));
                attempts += 1;
                if (attempts <= 2) throw rateLimitError();
                return [];
            },
        }, 1n, {
            rateLimitBaseDelayMs: 100,
            rateLimitMaxDelayMs: 1_000,
            sleep: async (ms) => {
                delays.push(ms);
            },
            onRateLimitRetry: (retry) => {
                retries.push(retry.attempt);
            },
        });

        await fetcher.getLogs({ address: ADDRESS, fromBlock: 5n, toBlock: 5n });

        expect(calls).toEqual([[5n, 5n], [5n, 5n], [5n, 5n]]);
        expect(delays).toEqual([100, 200]);
        expect(retries).toEqual([1, 2]);
    });

    it("uses Retry-After when a rate-limit response provides one", async () => {
        const delays: number[] = [];
        let attempts = 0;

        const fetcher = new LogsFetcher({
            async getLogs() {
                attempts += 1;
                if (attempts === 1) throw rateLimitError("3");
                return [];
            },
        }, 1n, {
            rateLimitBaseDelayMs: 100,
            sleep: async (ms) => {
                delays.push(ms);
            },
        });

        await fetcher.getLogs({ address: ADDRESS, fromBlock: 1n, toBlock: 1n });

        expect(delays).toEqual([3_000]);
    });

    it("backs off and retries Viem RPC errors that expose the rate limit as code", async () => {
        const delays: number[] = [];
        let attempts = 0;

        const fetcher = new LogsFetcher({
            async getLogs() {
                attempts += 1;
                if (attempts === 1) throw alchemyRpcRateLimitError();
                return [];
            },
        }, 1n, {
            rateLimitBaseDelayMs: 100,
            sleep: async (ms) => {
                delays.push(ms);
            },
        });

        await fetcher.getLogs({ address: ADDRESS, fromBlock: 1n, toBlock: 1n });

        expect(attempts).toBe(2);
        expect(delays).toEqual([100]);
    });

    it("continues to shrink chunks for non-rate-limit log range errors", async () => {
        const calls: [bigint | undefined, bigint | undefined][] = [];
        let attempts = 0;

        const fetcher = new LogsFetcher({
            async getLogs(parameters) {
                calls.push(readRange(parameters));
                attempts += 1;
                if (attempts === 1) throw new Error("range too large");
                return [];
            },
        }, 4n);

        await fetcher.getLogs({ address: ADDRESS, fromBlock: 1n, toBlock: 4n });

        expect(calls).toEqual([[1n, 4n], [1n, 2n], [3n, 4n]]);
    });
});

function readRange(parameters: GetLogsParameters): [bigint | undefined, bigint | undefined] {
    return [parameters.fromBlock, parameters.toBlock];
}

function rateLimitError(retryAfter?: string): unknown {
    return {
        status: 429,
        shortMessage: "HTTP request failed.",
        details: "Too Many Requests",
        headers: {
            get(name: string): string | null {
                if (name.toLowerCase() !== "retry-after") return null;
                return retryAfter ?? null;
            },
        },
    };
}

function alchemyRpcRateLimitError(): unknown {
    return {
        code: 429,
        shortMessage: "RPC Request failed.",
        details: "Your app has exceeded its compute units per second capacity.",
        cause: {
            code: 429,
            message: "Your app has exceeded its compute units per second capacity.",
        },
    };
}
