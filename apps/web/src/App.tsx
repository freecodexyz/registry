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

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; repos: Repo[] }
  | { status: 'error'; message: string }

function formatRegisteredAt(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString()
}

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function loadRepos() {
      try {
        const response = await fetch('/api/repos', { credentials: 'include', signal: controller.signal })

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        setState({ status: 'loaded', repos: await response.json() as Repo[] })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unable to load repos',
        })
      }
    }

    void loadRepos()

    return () => controller.abort()
  }, [])

  return (
    <main className="registry">
      <header className="registry-header">
        <div>
          <p className="eyebrow">Sepolia Registry</p>
          <h1>RIK Registry</h1>
        </div>
        <ConnectButton />
      </header>

      {state.status === 'loading' && <p className="status">Loading repos...</p>}

      {state.status === 'error' && (
        <p className="status error" role="alert">
          {state.message}
        </p>
      )}

      {state.status === 'loaded' && <RepoTable initialRepos={state.repos} />}
    </main>
  )
}

function RepoTable({ initialRepos }: { initialRepos: Repo[] }) {
  const repos = useLiveRepos(initialRepos)

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
