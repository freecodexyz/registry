import { describe, expect, it } from "vitest";
import { IndexerEngine, type BlockRange } from "./engine";

describe("IndexerEngine", () => {
    it("skips overlapping ticks while one tick is still running", async () => {
        const indexedRanges: BlockRange[] = [];
        const releaseStep = deferred<void>();
        let blockNumberCalls = 0;

        const engine = new IndexerEngine({
            client: {
                async getBlockNumber() {
                    blockNumberCalls += 1;
                    return 10n;
                },
            },
            checkpoint: {
                async getLastIndexedBlock() {
                    return 0n;
                },
                setLastIndexedBlock() {},
            },
            steps: [{
                name: "slow-step",
                async index(range) {
                    indexedRanges.push(range);
                    await releaseStep.promise;
                },
            }],
        });

        const firstTick = engine.tick();
        await waitFor(() => indexedRanges.length === 1);
        await engine.tick();

        releaseStep.resolve();
        await firstTick;

        expect(blockNumberCalls).toBe(1);
        expect(indexedRanges).toEqual([{ fromBlock: 1n, toBlock: 10n }]);
    });
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void } {
    let resolve: (value: T | PromiseLike<T>) => void = () => {};
    const promise = new Promise<T>((innerResolve) => {
        resolve = innerResolve;
    });

    return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 1));
    }

    throw new Error("condition was not met");
}
