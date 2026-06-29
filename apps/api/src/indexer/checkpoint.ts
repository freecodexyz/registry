import type { CheckpointStore } from "./engine";

type CheckpointDatabase = {
    prepare(sql: string): {
        get(...parameters: unknown[]): unknown;
        run(...parameters: unknown[]): unknown;
    };
};

type CheckpointRow = {
    value: string;
};

export type BlockCheckpointStoreOptions = {
    db: CheckpointDatabase;
    key: string;
    maxLookbackBlocks: bigint;
};

export class BlockCheckpointStore implements CheckpointStore {
    private readonly db: CheckpointDatabase;
    private readonly key: string;
    private readonly maxLookbackBlocks: bigint;

    constructor(options: BlockCheckpointStoreOptions) {
        this.db = options.db;
        this.key = options.key;
        this.maxLookbackBlocks = options.maxLookbackBlocks;
    }

    async getLastIndexedBlock(head: bigint): Promise<bigint> {
        const row = this.db.prepare("SELECT value FROM indexer_state WHERE key=?").get(this.key) as CheckpointRow | undefined;
        const oldestAvailableBlock = head > this.maxLookbackBlocks ? head - this.maxLookbackBlocks : 0n;
        const lastIndexedBlock = row ? BigInt(row.value) : oldestAvailableBlock;

        if (lastIndexedBlock < oldestAvailableBlock) {
            this.setLastIndexedBlock(oldestAvailableBlock);
            return oldestAvailableBlock;
        }

        return lastIndexedBlock;
    }

    setLastIndexedBlock(blockNumber: bigint): void {
        this.db.prepare(
            "INSERT INTO indexer_state (key, value) VALUES (?, ?) " +
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value"
        ).run(this.key, String(blockNumber));
    }
}
