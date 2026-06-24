import { parseReposResponse, type ReposResponse, type Sort } from './repositoryTypes'

const PAGE_SIZE = 50

export async function loadRepoPage(args: { q: string; sort: Sort; cursor: number | null; signal?: AbortSignal }): Promise<ReposResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), sort: args.sort })
  const search = args.q.trim()
  if (search) params.set('q', search)
  if (args.cursor != null) params.set('cursor', String(args.cursor))

  const response = await fetch(`/api/repos?${params}`, { credentials: 'include', signal: args.signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)

  return parseReposResponse(await response.json() as unknown)
}
