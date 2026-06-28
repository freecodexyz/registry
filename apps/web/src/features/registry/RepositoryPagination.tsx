import { Notice, Pagination, PaginationButton } from '@freecodexyz/ui'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

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
          <FiChevronLeft aria-hidden="true" focusable="false" />
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
          <FiChevronRight aria-hidden="true" focusable="false" />
        </PaginationButton>
      </Pagination>
      {nextPageError && <Notice tone="danger" role="alert" className="pagination-error">{nextPageError}</Notice>}
    </div>
  )
}
