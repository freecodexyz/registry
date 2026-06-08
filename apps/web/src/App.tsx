import { useEffect, useState } from 'react'
import { ConnectButton } from './ConnectButton'
import './App.css'

type Repo = {
  repoId: string;
  registrant: `0x${string}`;
  githubOwnerId: number;
  registeredAt: number;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; repos: Repo[] }
  | { status: 'error'; message: string }

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    async function loadRepos() {
      try {
        const response = await fetch('/api/repos', { signal: controller.signal })

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

      {state.status === 'loaded' && state.repos.length === 0 && (
        <p className="status">No repos registered yet.</p>
      )}

      {state.status === 'loaded' && state.repos.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>repoId</th>
                <th>registrant</th>
                <th>ownerId</th>
                <th>registeredAt</th>
              </tr>
            </thead>
            <tbody>
              {state.repos.map((repo) => (
                <tr key={`${repo.repoId}-${repo.registrant}`}>
                  <td>{repo.repoId}</td>
                  <td>{repo.registrant}</td>
                  <td>{repo.githubOwnerId}</td>
                  <td>{repo.registeredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

export default App
