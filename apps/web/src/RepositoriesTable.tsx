import { useEffect, useState } from 'react'
import { useChainId } from 'wagmi'
import { base, baseSepolia, sepolia } from 'wagmi/chains'
import githubLogoUrl from './assets/GitHub_Invertocat_Black.svg'
import { Button, Field, Input, Notice, Select, Table, TableCell, TableHeader, TableViewport } from './components/ui'
import type { Repo, ReposResponse, Sort } from './repositoryTypes'
import { useLiveRepos } from './useLiveRepos'

type LoadState =
  | { status: 'loading'; repos: Repo[]; nextCursor: number | null }
  | { status: 'loaded'; repos: Repo[]; nextCursor: number | null }
  | { status: 'error'; repos: Repo[]; nextCursor: number | null; message: string }

const PAGE_SIZE = 50
const COMPACT_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const EXPLORER_ADDRESS_URLS: Record<number, string> = {
  [sepolia.id]: 'https://sepolia.etherscan.io/address/',
  [base.id]: 'https://basescan.org/address/',
  [baseSepolia.id]: 'https://sepolia.basescan.org/address/',
}

async function loadRepoPage(args: { q: string; sort: Sort; cursor: number | null; signal?: AbortSignal }): Promise<ReposResponse> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), sort: args.sort })
  const search = args.q.trim()
  if (search) params.set('q', search)
  if (args.cursor != null) params.set('cursor', String(args.cursor))

  const response = await fetch(`/api/repos?${params}`, { credentials: 'include', signal: args.signal })
  if (!response.ok) throw new Error(`API returned ${response.status}`)
  return await response.json() as ReposResponse
}

function formatAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function explorerAddressUrl(chainId: number, address: `0x${string}`) {
  return `${EXPLORER_ADDRESS_URLS[chainId] ?? EXPLORER_ADDRESS_URLS[sepolia.id]}${address}`
}

function formatRegisteredAt(timestamp: number) {
  return COMPACT_DATE.format(new Date(timestamp * 1000))
}

export function RepositoriesTable() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('registered_at_desc')
  const [state, setState] = useState<LoadState>({ status: 'loading', repos: [], nextCursor: null })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRepos() {
      setState({ status: 'loading', repos: [], nextCursor: null })
      setLoadMoreError(null)

      try {
        const page = await loadRepoPage({ q, sort, cursor: null, signal: controller.signal })
        setState({ status: 'loaded', repos: page.repos, nextCursor: page.nextCursor })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState({
          status: 'error',
          repos: [],
          nextCursor: null,
          message: err instanceof Error ? err.message : 'Unable to load repos',
        })
      }
    }

    void loadRepos()

    return () => controller.abort()
  }, [q, sort])

  async function loadMore() {
    if (state.status !== 'loaded' || state.nextCursor == null || isLoadingMore) return

    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const page = await loadRepoPage({ q, sort, cursor: state.nextCursor })
      setState((cur) => cur.status === 'loaded' ? {
        status: 'loaded',
        repos: [...cur.repos, ...page.repos],
        nextCursor: page.nextCursor,
      } : cur)
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err.message : 'Unable to load more repos')
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <section className="repositories" aria-label="Repositories">
      <section className="registry-controls" aria-label="Repository filters">
        <Field label="Search" className="registry-search">
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="repo, owner, language, address..."
            type="search"
          />
        </Field>
        <Field label="Sort">
          <Select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="registered_at_desc">Newest first</option>
            <option value="registered_at_asc">Oldest first</option>
            <option value="stars_desc">Most stars</option>
          </Select>
        </Field>
      </section>

      {state.status === 'loading' && <Notice>Loading repos...</Notice>}

      {state.status === 'error' && (
        <Notice tone="danger" role="alert">
          {state.message}
        </Notice>
      )}

      {state.status === 'loaded' && (
        <>
          <RepoTable initialRepos={state.repos} q={q} sort={sort} />
          {state.nextCursor != null && (
            <div className="pagination">
              <Button variant="ghost" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </Button>
              {loadMoreError && <Notice tone="danger" role="alert" className="pagination-error">{loadMoreError}</Notice>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function RepoTable({ initialRepos, q, sort }: { initialRepos: Repo[]; q: string; sort: Sort }) {
  const chainId = useChainId()
  const repos = useLiveRepos(initialRepos, { q, sort })

  if (repos.length === 0) return <Notice>No repos registered yet.</Notice>

  return (
    <TableViewport>
      <Table className="repositories-table">
        <thead>
          <tr>
            <TableHeader>GITHUB</TableHeader>
            <TableHeader>language</TableHeader>
            <TableHeader numeric>stars</TableHeader>
            <TableHeader>address</TableHeader>
            <TableHeader>owner</TableHeader>
            <TableHeader>registered_at</TableHeader>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => {
            const github = repo.github === 'not found' ? null : repo.github
            const ownerLabel = repo.githubOwnerUsername === 'not found' ? String(repo.githubOwnerId) : repo.githubOwnerUsername
            const registeredDate = new Date(repo.registeredAt * 1000)

            return (
              <tr key={`${repo.repoId}-${repo.registrant}`}>
                <TableCell>
                  {github ? (
                    <a className="repo-github-link fcf-link" href={github.htmlUrl} target="_blank" rel="noreferrer">
                      <img className="repo-github-icon" src={githubLogoUrl} alt="" />
                      {github.fullName}
                    </a>
                  ) : (
                    'not found'
                  )}
                </TableCell>
                <TableCell mono>{github?.language ?? '-'}</TableCell>
                <TableCell numeric>
                  {github ? (
                    <span className="repo-stars">
                      <svg className="repo-star-icon" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 1.15 10.1 5.4l4.7.68-3.4 3.31.8 4.68L8 11.86l-4.2 2.21.8-4.68-3.4-3.31 4.7-.68L8 1.15Z" />
                      </svg>
                      {github.stars.toLocaleString()}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell mono>
                  <a className="repo-address fcf-link" href={explorerAddressUrl(chainId, repo.registrant)} target="_blank" rel="noreferrer">
                    {formatAddress(repo.registrant)}
                  </a>
                </TableCell>
                <TableCell mono>
                  {repo.githubOwnerUsername === 'not found' ? ownerLabel : (
                    <a className="repo-owner-link fcf-link" href={`https://github.com/${repo.githubOwnerUsername}`} target="_blank" rel="noreferrer">
                      {ownerLabel}
                    </a>
                  )}
                </TableCell>
                <TableCell mono>
                  <time className="repo-date" dateTime={registeredDate.toISOString()}>{formatRegisteredAt(repo.registeredAt)}</time>
                </TableCell>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableViewport>
  )
}
