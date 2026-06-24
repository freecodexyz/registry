import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { loadRepoPage } from './repositoryApi'
import type { Repo, Sort } from './repositoryTypes'
import { useLiveRepos } from './useLiveRepos'

type RepositoryPagesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
    status: 'loaded';
    repos: Repo[];
    pageCount: number;
    isCurrentPageLoaded: boolean;
    hasNextPage: boolean;
    isLoadingMore: boolean;
    nextPageError: string | null;
    loadNextPage: (targetPageIndex: number) => Promise<boolean>;
  }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function useRepositoryPages({ q, sort, pageIndex }: { q: string; sort: Sort; pageIndex: number }): RepositoryPagesState {
  const reposQuery = useInfiniteQuery({
    queryKey: ['repos', { q, sort }],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam, signal }) => loadRepoPage({ q, sort, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
  const { error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, status } = reposQuery
  const pages = reposQuery.data?.pages ?? []
  const currentPage = status === 'success' ? pages[pageIndex] : undefined
  const repos = useLiveRepos(currentPage?.repos ?? [], { q, sort })
  const queryErrorMessage = errorMessage(error, 'Unable to load repos')

  useEffect(() => {
    if (status !== 'success') return
    if (pageIndex < pages.length) return
    if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) return

    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, pageIndex, pages.length, status])

  if (status === 'pending') return { status: 'loading' }
  if (status === 'error') return { status: 'error', message: queryErrorMessage }

  async function loadNextPage(targetPageIndex: number) {
    const result = await fetchNextPage()
    return Boolean(result.data?.pages[targetPageIndex])
  }

  return {
    status: 'loaded',
    repos,
    pageCount: pages.length,
    isCurrentPageLoaded: Boolean(currentPage),
    hasNextPage: Boolean(hasNextPage),
    isLoadingMore: isFetchingNextPage,
    nextPageError: isFetchNextPageError ? queryErrorMessage : null,
    loadNextPage,
  }
}
