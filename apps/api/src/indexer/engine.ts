export type BlockRange = {
    fromBlock: bigint;
    toBlock: bigint;
};

export interface ChainHeadClient {
    getBlockNumber(): Promise<bigint>;
}

export interface IndexerStep {
    readonly name: string;
    index(range: BlockRange): Promise<void>;
}

export interface CheckpointStore {
    getLastIndexedBlock(head: bigint): Promise<bigint>;
    setLastIndexedBlock(blockNumber: bigint): void;
}

export type IndexerEngineOptions = {
    client: ChainHeadClient;
    checkpoint: CheckpointStore;
    steps: readonly IndexerStep[];
};

export class IndexerEngine {
    private readonly client: ChainHeadClient;
    private readonly checkpoint: CheckpointStore;
    private readonly steps: readonly IndexerStep[];

    constructor(options: IndexerEngineOptions) {
        this.client = options.client;
        this.checkpoint = options.checkpoint;
        this.steps = options.steps;
    }

    async tick(): Promise<void> {
        const head = await this.client.getBlockNumber();
        const range = await this.getRange(head);
        if (!range) return;

        for (const step of this.steps) {
            await step.index(range);
        }

        this.checkpoint.setLastIndexedBlock(range.toBlock);
    }

    protected async getRange(head: bigint): Promise<BlockRange | null> {
        const fromBlock = await this.checkpoint.getLastIndexedBlock(head) + 1n;
        if (fromBlock > head) return null;

        return { fromBlock, toBlock: head };
    }
}
