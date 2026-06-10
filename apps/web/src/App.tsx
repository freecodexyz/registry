import { useEffect, useState } from 'react'
import { ConnectButton } from './ConnectButton'
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
    <main className="registry">
      <header className="registry-header">
        <div>
          <p className="eyebrow">Sepolia Registry</p>
          <h1>RIK Registry</h1>
        </div>
        <ConnectButton />
      </header>

      <section className="registry-controls" aria-label="Repository filters">
        <label>
          Search
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="repo, owner, language, address..."
            type="search"
          />
        </label>
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="registered_at_desc">Newest first</option>
            <option value="registered_at_asc">Oldest first</option>
            <option value="stars_desc">Most stars</option>
          </select>
        </label>
      </section>

      {state.status === 'loading' && <p className="status">Loading repos...</p>}

      {state.status === 'error' && (
        <p className="status error" role="alert">
          {state.message}
        </p>
      )}

      {state.status === 'loaded' && (
        <>
          <RepoTable initialRepos={state.repos} q={q} sort={sort} />
          {state.nextCursor != null && (
            <div className="pagination">
              <button type="button" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
              {loadMoreError && <p className="status error" role="alert">{loadMoreError}</p>}
            </div>
          )}
        </>
      )}
    </main>
  )
}

function RepoTable({ initialRepos, q, sort }: { initialRepos: Repo[]; q: string; sort: Sort }) {
  const repos = useLiveRepos(initialRepos, { q, sort })

  if (repos.length === 0) return <p className="status">No repos registered yet.</p>

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>repoId</th>
            <th>github</th>
            <th>language</th>
            <th>stars</th>
            <th>registrant</th>
            <th>owner</th>
            <th>registeredAt</th>
          </tr>
        </thead>
        <tbody>
          {repos.map((repo) => {
            const github = repo.github === 'not found' ? null : repo.github

            return (
              <tr key={`${repo.repoId}-${repo.registrant}`}>
                <td>{repo.repoId}</td>
                <td>
                  {github ? (
                    <>
                      <a href={github.htmlUrl} target="_blank" rel="noreferrer">
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
                </td>
                <td>{github?.language ?? '-'}</td>
                <td>{github ? github.stars.toLocaleString() : '-'}</td>
                <td>{repo.registrant}</td>
                <td>{repo.githubOwnerUsername === 'not found' ? repo.githubOwnerId : repo.githubOwnerUsername}</td>
                <td>{formatRegisteredAt(repo.registeredAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default App
