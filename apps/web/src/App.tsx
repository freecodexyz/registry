import { GateView } from './GateView'
import { RepositoriesTable } from './RepositoriesTable'
import { TopNavbar } from './TopNavbar'
import { useAuthSession } from './useAuthSession'
import './App.css'

function App() {
  const { isSignedIn, isSessionLoading } = useAuthSession()

  if (isSessionLoading || !isSignedIn) return (
    <>
      <TopNavbar />
      <GateView />
    </>
  )

  return (
    <>
      <TopNavbar />
      <main className="registry" data-accent="emerald">
        <header className="registry-header">
          <div>
            <h1>RIK Registry</h1>
            <p className="registry-lede">Live, gated registry data indexed from Sepolia and enriched with GitHub metadata.</p>
          </div>
        </header>

        <RepositoriesTable />
      </main>
    </>
  )
}

export default App
