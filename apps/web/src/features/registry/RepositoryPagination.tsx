import { Notice, Pagination, PaginationButton } from '@freecodexyz/ui'

type RepositoryPaginationProps = {
  pageIndex: number;
  pageCount: number;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  nextPageError: string | null;
  onPreviousPage: () => void;
  onPage: (pageIndex: number) => void;
  onNextPage: () => void;
}

export function RepositoryPagination({ pageIndex, pageCount, hasNextPage, isLoadingMore, nextPageError, onPreviousPage, onPage, onNextPage }: RepositoryPaginationProps) {
  return (
    <div className="pagination">
      <Pagination className="repo-pagination" aria-label="Repository pages">
        <PaginationButton aria-label="Previous page" onClick={onPreviousPage} disabled={pageIndex === 0 || isLoadingMore}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10.5 3.5 6 8l4.5 4.5-1.2 1.2L3.6 8l5.7-5.7 1.2 1.2Z" />
          </svg>
        </PaginationButton>
        {Array.from({ length: pageCount }, (_, loadedPageIndex) => (
          <PaginationButton key={`repo-page-${loadedPageIndex + 1}`} current={loadedPageIndex === pageIndex} onClick={() => onPage(loadedPageIndex)} disabled={isLoadingMore}>
            {loadedPageIndex + 1}
          </PaginationButton>
        ))}
        <PaginationButton
          aria-label="Next page"
          onClick={onNextPage}
          disabled={isLoadingMore || (pageIndex >= pageCount - 1 && !hasNextPage)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m5.5 12.5 4.5-4.5-4.5-4.5 1.2-1.2L12.4 8l-5.7 5.7-1.2-1.2Z" />
          </svg>
        </PaginationButton>
      </Pagination>
      {nextPageError && <Notice tone="danger" role="alert" className="pagination-error">{nextPageError}</Notice>}
    </div>
  )
}
