import { Notice } from '@freecodexyz/ui'
import { RepoTable } from './RepoTable'
import { RepositoryFilters } from './RepositoryFilters'
import { RepositoryDetailsDrawer } from './RepositoryDetailsDrawer'
import { RepositoryPagination } from './RepositoryPagination'
import { useRegistryUrlState } from './registryUrlState'
import { useRepositoryPages } from './useRepositoryPages'

export function RepositoriesTable() {
  const registryUrl = useRegistryUrlState()
  const repositories = useRepositoryPages({ q: registryUrl.q, sort: registryUrl.sort, pageIndex: registryUrl.pageIndex })
  const selectedRepo = repositories.status === 'loaded' && registryUrl.selectedRepoId
    ? repositories.repos.find((repo) => repo.repoId === registryUrl.selectedRepoId) ?? null
    : null

  function goToPreviousPage() {
    if (registryUrl.pageIndex === 0) return
    registryUrl.goToPage(registryUrl.pageIndex - 1)
  }

  async function goToNextPage() {
    if (repositories.status !== 'loaded' || repositories.isLoadingMore) return

    if (registryUrl.pageIndex < repositories.pageCount - 1) {
      registryUrl.goToPage(registryUrl.pageIndex + 1)
      return
    }

    if (!repositories.hasNextPage) return

    if (await repositories.loadNextPage(registryUrl.pageIndex + 1)) {
      registryUrl.goToPage(registryUrl.pageIndex + 1)
    }
  }

  return (
    <section className="repositories" aria-label="Repositories">
      <RepositoryFilters q={registryUrl.q} sort={registryUrl.sort} onSearchChange={registryUrl.changeSearch} onSortChange={registryUrl.changeSort} />

      {repositories.status === 'loading' && <Notice>Loading repos...</Notice>}
      {repositories.status === 'error' && (
        <Notice tone="danger" role="alert">
          {repositories.message}
        </Notice>
      )}
      {repositories.status === 'loaded' && (
        <>
          {repositories.isCurrentPageLoaded ? (
            <RepoTable repos={repositories.repos} onSelectRepo={(repo) => registryUrl.selectRepo(repo.repoId)} emptyMessage={registryUrl.q ? 'No repos match the current filters.' : 'No repos registered yet.'} />
          ) : (
            <Notice>{repositories.nextPageError ? 'Unable to load this page.' : repositories.hasNextPage ? 'Loading repos...' : 'No repos on this page.'}</Notice>
          )}
          <RepositoryPagination
            pageIndex={registryUrl.pageIndex}
            pageCount={repositories.pageCount}
            hasNextPage={repositories.hasNextPage}
            isLoadingMore={repositories.isLoadingMore}
            nextPageError={repositories.nextPageError}
            onPreviousPage={goToPreviousPage}
            onPage={registryUrl.goToPage}
            onNextPage={() => void goToNextPage()}
          />
        </>
      )}
      {selectedRepo ? <RepositoryDetailsDrawer status="open" repo={selectedRepo} onClose={registryUrl.closeRepoDetails} /> : <RepositoryDetailsDrawer status="closed" />}
    </section>
  )
}
