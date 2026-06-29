import type { AbiEvent, GetLogsParameters, GetLogsReturnType } from "viem";

type GetLogsRange = {
    fromBlock: bigint;
    toBlock: bigint;
};

type LogsClient = {
    getLogs(parameters: GetLogsParameters): Promise<readonly unknown[]>;
};

export class LogsFetcher {
    private currentChunkRange: bigint;

    constructor(
        private readonly client: LogsClient,
        private readonly maxLogRange: bigint,
    ) {
        if (maxLogRange < 1n) throw new Error("maxLogRange must be at least 1 block");
        this.currentChunkRange = maxLogRange;
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
            } catch (error) {
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
}
