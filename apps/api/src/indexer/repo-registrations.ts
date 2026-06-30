import type { Octokit } from "@octokit/rest";
import type { Address, Hash } from "viem";
import { db, insertRepo, upsertMeta } from "../db/db";
import { fetchOwnerUsername, fetchRepoMetaData } from "../shared/github";
import type { RepoRegisteredEvent } from "../index";
import type { EventMessage } from "../shared/events-socket";
import type { BlockRange, IndexerStep } from "./engine";
import type { LogsFetcher } from "./fetch-logs";

type RepoRegistrationLog = {
    args: {
        repoId: bigint;
        registrant: Address;
        githubOwnerId: bigint;
        registeredAt: bigint;
    };
    blockNumber: bigint;
    transactionHash: Hash | null;
};

type RepoRegistrationPublisher = (message: EventMessage) => void;

export type RepoRegistrationIndexerOptions = {
    address: Address;
    event: typeof RepoRegisteredEvent;
    chainId: number;
    registryAddress: Address;
    logsFetcher: LogsFetcher;
    github: Octokit;
    publishEventMessage: RepoRegistrationPublisher;
};

export class RepoRegistrationIndexer implements IndexerStep {
    readonly name = "repo-registrations";

    private readonly address: Address;
    private readonly event: typeof RepoRegisteredEvent;
    private readonly chainId: number;
    private readonly registryAddress: Address;
    private readonly logsFetcher: LogsFetcher;
    private readonly github: Octokit;
    private readonly publishEventMessage: RepoRegistrationPublisher;

    constructor(options: RepoRegistrationIndexerOptions) {
        this.address = options.address;
        this.event = options.event;
        this.chainId = options.chainId;
        this.registryAddress = options.registryAddress;
        this.logsFetcher = options.logsFetcher;
        this.github = options.github;
        this.publishEventMessage = options.publishEventMessage;
    }

    async index(range: BlockRange): Promise<void> {
        const logs = await this.fetch(range);
        this.insert(logs);
        await this.enrich(logs);
    }

    private async fetch(range: BlockRange): Promise<RepoRegistrationLog[]> {
        const logs = await this.logsFetcher.getLogs({
            address: this.address,
            event: this.event,
            fromBlock: range.fromBlock,
            toBlock: range.toBlock,
        });

        return logs.map((log) => ({
            args: {
                repoId: log.args.repoId,
                registrant: log.args.registrant,
                githubOwnerId: log.args.githubOwnerId,
                registeredAt: log.args.registeredAt,
            },
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash ?? null,
        }));
    }

    private insert(logs: readonly RepoRegistrationLog[]): void {
        const insertTx = db.transaction((rows: readonly RepoRegistrationLog[]) => {
            for (const l of rows) {
                insertRepo.run(
                    String(l.args.repoId), l.args.registrant,
                    Number(l.args.githubOwnerId), Number(l.args.registeredAt),
                    Number(l.blockNumber), l.transactionHash, this.chainId
                );
            }
        });

        insertTx(logs);
    }

    private async enrich(logs: readonly RepoRegistrationLog[]): Promise<void> {
        for (const l of logs) {
            const [metadata, ownerUsername] = await Promise.all([
                fetchRepoMetaData(this.github, Number(l.args.repoId)),
                fetchOwnerUsername(this.github, l.args.githubOwnerId),
            ]);
            upsertMeta.run(String(l.args.repoId), metadata?.fullName ?? null, metadata?.description ?? null,
                metadata?.language ?? null, metadata?.stars ?? null, metadata?.htmlUrl ?? null, ownerUsername, Date.now());

            this.publishEventMessage({ topic: "repo", payload: {
                repoId: String(l.args.repoId),
                registrant: l.args.registrant,
                githubOwnerId: Number(l.args.githubOwnerId),
                githubOwnerUsername: ownerUsername ?? "not found",
                registeredAt: Number(l.args.registeredAt),
                blockNumber: Number(l.blockNumber),
                transactionHash: l.transactionHash,
                chainId: this.chainId,
                registryAddress: this.registryAddress,
                github: metadata ?? "not found",
            } });
        }
    }
}
