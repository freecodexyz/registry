export type GithubRepo = {
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  htmlUrl: string;
}

export type Repo = {
  repoId: string;
  registrant: `0x${string}`;
  githubOwnerId: number;
  githubOwnerUsername: string | 'not found';
  registeredAt: number;
  blockNumber: number;
  transactionHash: `0x${string}` | null;
  chainId: number;
  registryAddress: `0x${string}`;
  github: GithubRepo | 'not found';
}

export type Sort = 'registered_at_desc' | 'registered_at_asc' | 'stars_desc'

export type ReposResponse = {
  repos: Repo[];
  nextCursor: number | null;
}
