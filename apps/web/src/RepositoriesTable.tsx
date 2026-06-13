import { useEffect, useState } from 'react'
import githubLogoUrl from './assets/GitHub_Invertocat_Black.svg'
import { Field, Input, Notice, Pagination, PaginationButton, Select, Table, TableCell, TableHeader, TableViewport } from '@freecodexyz/ui'
import { explorerAddressUrl } from './explorers'
import { RepositoryDetailsDrawer } from './RepositoryDetailsDrawer'
import type { Repo, ReposResponse, Sort } from './repositoryTypes'
import { useLiveRepos } from './useLiveRepos'

type LoadState =
  | { status: 'loading'; pages: RepoPage[]; currentPage: number }
  | { status: 'loaded'; pages: RepoPage[]; currentPage: number }
  | { status: 'error'; pages: RepoPage[]; currentPage: number; message: string }

type RepoPage = {
  repos: Repo[];
  nextCursor: number | null;
}

const PAGE_SIZE = 50
const COMPACT_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

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

function formatRegisteredAt(timestamp: number) {
  return COMPACT_DATE.format(new Date(timestamp * 1000))
}

export function RepositoriesTable() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('registered_at_desc')
  const [state, setState] = useState<LoadState>({ status: 'loading', pages: [], currentPage: 0 })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRepos() {
      setState({ status: 'loading', pages: [], currentPage: 0 })
      setLoadMoreError(null)

      try {
        const page = await loadRepoPage({ q, sort, cursor: null, signal: controller.signal })
        setState({ status: 'loaded', pages: [page], currentPage: 0 })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState({
          status: 'error',
          pages: [],
          currentPage: 0,
          message: err instanceof Error ? err.message : 'Unable to load repos',
        })
      }
    }

    void loadRepos()

    return () => controller.abort()
  }, [q, sort])

  function goToPage(pageIndex: number) {
    setState((cur) => cur.status === 'loaded' && cur.pages[pageIndex] ? { ...cur, currentPage: pageIndex } : cur)
  }

  function goToPreviousPage() {
    setState((cur) => cur.status === 'loaded' && cur.currentPage > 0 ? { ...cur, currentPage: cur.currentPage - 1 } : cur)
  }

  async function goToNextPage() {
    if (state.status !== 'loaded' || isLoadingMore) return

    if (state.currentPage < state.pages.length - 1) {
      setState((cur) => cur.status === 'loaded' ? { ...cur, currentPage: cur.currentPage + 1 } : cur)
      return
    }

    const currentPage = state.pages[state.currentPage]
    if (!currentPage || currentPage.nextCursor == null) return

    setIsLoadingMore(true)
    setLoadMoreError(null)

    try {
      const page = await loadRepoPage({ q, sort, cursor: currentPage.nextCursor })
      setState((cur) => cur.status === 'loaded' ? {
        status: 'loaded',
        pages: [...cur.pages, page],
        currentPage: cur.currentPage + 1,
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
          <RepoTable initialRepos={state.pages[state.currentPage]?.repos ?? []} q={q} sort={sort} onSelectRepo={setSelectedRepo} />
          <div className="pagination">
            <Pagination className="repo-pagination" aria-label="Repository pages">
              <PaginationButton aria-label="Previous page" onClick={goToPreviousPage} disabled={state.currentPage === 0 || isLoadingMore}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10.5 3.5 6 8l4.5 4.5-1.2 1.2L3.6 8l5.7-5.7 1.2 1.2Z" />
                </svg>
              </PaginationButton>
              {state.pages.map((_, pageIndex) => (
                <PaginationButton key={pageIndex} current={pageIndex === state.currentPage} onClick={() => goToPage(pageIndex)} disabled={isLoadingMore}>
                  {pageIndex + 1}
                </PaginationButton>
              ))}
              <PaginationButton
                aria-label="Next page"
                onClick={goToNextPage}
                disabled={isLoadingMore || (state.currentPage >= state.pages.length - 1 && state.pages[state.currentPage]?.nextCursor == null)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m5.5 12.5 4.5-4.5-4.5-4.5 1.2-1.2L12.4 8l-5.7 5.7-1.2-1.2Z" />
                </svg>
              </PaginationButton>
            </Pagination>
            {loadMoreError && <Notice tone="danger" role="alert" className="pagination-error">{loadMoreError}</Notice>}
          </div>
        </>
      )}
      <RepositoryDetailsDrawer repo={selectedRepo} onClose={() => setSelectedRepo(null)} />
    </section>
  )
}

function RepoTable({ initialRepos, q, sort, onSelectRepo }: { initialRepos: Repo[]; q: string; sort: Sort; onSelectRepo: (repo: Repo) => void }) {
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
              <tr
                key={`${repo.repoId}-${repo.registrant}`}
                className="repo-table-row"
                role="button"
                tabIndex={0}
                onClick={() => onSelectRepo(repo)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onSelectRepo(repo)
                }}
              >
                <TableCell>
                  {github ? (
                    <a className="repo-github-link fcf-link" href={github.htmlUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
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
                  <a className="repo-address fcf-link" href={explorerAddressUrl(repo.chainId, repo.registrant)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                    {formatAddress(repo.registrant)}
                  </a>
                </TableCell>
                <TableCell mono>
                  {repo.githubOwnerUsername === 'not found' ? ownerLabel : (
                    <a className="repo-owner-link fcf-link" href={`https://github.com/${repo.githubOwnerUsername}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
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
