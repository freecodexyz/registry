import { RepositoriesTable } from './RepositoriesTable'

export function Registry() {
  return (
    <main className="registry" data-accent="emerald">
      <header className="registry-header">
        <div>
          <h1>Registry</h1>
        </div>
      </header>

      <RepositoriesTable />
    </main>
  )
}
