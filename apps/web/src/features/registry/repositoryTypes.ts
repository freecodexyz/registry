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

export const SORTS = ['registered_at_desc', 'registered_at_asc', 'stars_desc'] as const

export type Sort = (typeof SORTS)[number]

export type ReposResponse = {
  repos: Repo[];
  nextCursor: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHexString(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && value.startsWith('0x')
}

function isGithubRepo(value: unknown): value is GithubRepo {
  return isRecord(value) &&
    typeof value.fullName === 'string' &&
    (typeof value.description === 'string' || value.description === null) &&
    (typeof value.language === 'string' || value.language === null) &&
    typeof value.stars === 'number' &&
    typeof value.htmlUrl === 'string'
}

export function isSort(value: unknown): value is Sort {
  return typeof value === 'string' && SORTS.includes(value as Sort)
}

export function isRepo(value: unknown): value is Repo {
  if (!isRecord(value)) return false

  return typeof value.repoId === 'string' &&
    isHexString(value.registrant) &&
    typeof value.githubOwnerId === 'number' &&
    (typeof value.githubOwnerUsername === 'string' || value.githubOwnerUsername === 'not found') &&
    typeof value.registeredAt === 'number' &&
    typeof value.blockNumber === 'number' &&
    (isHexString(value.transactionHash) || value.transactionHash === null) &&
    typeof value.chainId === 'number' &&
    isHexString(value.registryAddress) &&
    (value.github === 'not found' || isGithubRepo(value.github))
}

export function parseReposResponse(value: unknown): ReposResponse {
  if (
    isRecord(value) &&
    Array.isArray(value.repos) &&
    value.repos.every(isRepo) &&
    (typeof value.nextCursor === 'number' || value.nextCursor === null)
  ) {
    return { repos: value.repos, nextCursor: value.nextCursor }
  }

  throw new Error('invalid repos response')
}
