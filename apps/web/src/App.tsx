import { useEffect, useState } from 'react'
import { ConnectButton } from './ConnectButton'
import { GateView } from './GateView'
import { Button, Eyebrow, Field, Input, Notice, Select, Status, Table, TableCell, TableHeader, TableViewport } from './components/ui'
import { useAuthSession } from './useAuthSession'
import { useLiveRepos } from './useLiveRepos'
import './App.css'

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
  github: GithubRepo | 'not found';
}

export type Sort = 'registered_at_desc' | 'registered_at_asc' | 'stars_desc'

type ReposResponse = {
  repos: Repo[];
  nextCursor: number | null;
}

type LoadState =
  | { status: 'loading'; repos: Repo[]; nextCursor: number | null }
  | { status: 'loaded'; repos: Repo[]; nextCursor: number | null }
  | { status: 'error'; repos: Repo[]; nextCursor: number | null; message: string }

const PAGE_SIZE = 50

function formatRegisteredAt(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString()
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

function App() {
  const { isSignedIn, isSessionLoading } = useAuthSession()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('registered_at_desc')
  const [state, setState] = useState<LoadState>({ status: 'loading', repos: [], nextCursor: null })
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)

  useEffect(() => {
    if (isSessionLoading || !isSignedIn) return

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
  }, [q, sort, isSessionLoading, isSignedIn])

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

  if (isSessionLoading || !isSignedIn) return <GateView />

  return (
    <main className="registry" data-accent="emerald">
      <header className="registry-header fcf-frame fcf-frame--accent">
        <div>
          <Eyebrow>Sepolia Registry</Eyebrow>
          <h1>RIK Registry</h1>
          <p className="registry-lede">Live, gated registry data indexed from Sepolia and enriched with GitHub metadata.</p>
        </div>
        <Status>Live data</Status>
        <ConnectButton />
      </header>

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
    </main>
  )
}

function RepoTable({ initialRepos, q, sort }: { initialRepos: Repo[]; q: string; sort: Sort }) {
  const repos = useLiveRepos(initialRepos, { q, sort })

  if (repos.length === 0) return <Notice>No repos registered yet.</Notice>

  return (
    <TableViewport>
      <Table>
        <thead>
          <tr>
            <TableHeader>repoId</TableHeader>
            <TableHeader>github</TableHeader>
            <TableHeader>language</TableHeader>
            <TableHeader numeric>stars</TableHeader>
            <TableHeader>registrant</TableHeader>
            <TableHeader>owner</TableHeader>
            <TableHeader>registeredAt</TableHeader>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => {
            const github = repo.github === 'not found' ? null : repo.github

            return (
              <tr key={`${repo.repoId}-${repo.registrant}`}>
                <TableCell mono>{repo.repoId}</TableCell>
                <TableCell>
                  {github ? (
                    <>
                      <a className="fcf-link" href={github.htmlUrl} target="_blank" rel="noreferrer">
                        {github.fullName}
                      </a>
                      {github.description && (
                        <>
                          <br />
                          <small>{github.description}</small>
                        </>
                      )}
                    </>
                  ) : (
                    'not found'
                  )}
                </TableCell>
                <TableCell mono>{github?.language ?? '-'}</TableCell>
                <TableCell numeric>{github ? github.stars.toLocaleString() : '-'}</TableCell>
                <TableCell mono>{repo.registrant}</TableCell>
                <TableCell mono>{repo.githubOwnerUsername === 'not found' ? repo.githubOwnerId : repo.githubOwnerUsername}</TableCell>
                <TableCell mono>{formatRegisteredAt(repo.registeredAt)}</TableCell>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableViewport>
  )
}

export default App
