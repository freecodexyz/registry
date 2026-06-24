import { useSearchParams } from 'react-router'
import { isSort, type Sort } from './repositoryTypes'

const DEFAULT_SORT: Sort = 'registered_at_desc'

function readPageIndex(value: string | null) {
  if (!value) return 0
  const page = Number(value)
  return Number.isInteger(page) && page > 1 ? page - 1 : 0
}

export function useRegistryUrlState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const sortParam = searchParams.get('sort')
  const sort = isSort(sortParam) ? sortParam : DEFAULT_SORT
  const pageIndex = readPageIndex(searchParams.get('page'))
  const selectedRepoId = searchParams.get('repo')

  function updateSearchParams(update: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    update(next)
    setSearchParams(next)
  }

  function setPage(nextPageIndex: number, params = new URLSearchParams(searchParams)) {
    if (nextPageIndex > 0) params.set('page', String(nextPageIndex + 1))
    else params.delete('page')
  }

  function changeSearch(value: string) {
    updateSearchParams((next) => {
      if (value) next.set('q', value)
      else next.delete('q')
      next.delete('repo')
      setPage(0, next)
    })
  }

  function changeSort(value: string) {
    const nextSort = isSort(value) ? value : DEFAULT_SORT
    updateSearchParams((next) => {
      if (nextSort === DEFAULT_SORT) next.delete('sort')
      else next.set('sort', nextSort)
      next.delete('repo')
      setPage(0, next)
    })
  }

  function selectRepo(repoId: string) {
    updateSearchParams((next) => {
      next.set('repo', repoId)
    })
  }

  function closeRepoDetails() {
    updateSearchParams((next) => {
      next.delete('repo')
    })
  }

  function goToPage(nextPageIndex: number) {
    updateSearchParams((next) => {
      next.delete('repo')
      setPage(nextPageIndex, next)
    })
  }

  return {
    q,
    sort,
    pageIndex,
    selectedRepoId,
    changeSearch,
    changeSort,
    selectRepo,
    closeRepoDetails,
    goToPage,
  }
}
