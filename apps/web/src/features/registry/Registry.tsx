import { RepositoriesTable } from './RepositoriesTable'

export function Registry() {
  return (
    <main className="registry" data-accent="emerald">
      <header className="registry-header">
        <div>
          <h1>RIK Registry</h1>
          <p className="registry-lede">Live, gated registry data indexed from Base Sepolia and enriched with GitHub metadata.</p>
        </div>
      </header>

      <RepositoriesTable />
    </main>
  )
}
