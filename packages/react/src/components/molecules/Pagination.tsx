import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type PaginationProps = Omit<HTMLAttributes<HTMLElement>, 'onChange'> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  { className, page, pageCount, onPageChange, ...props },
  ref,
) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const goTo = (target: number) => {
    if (pageCount <= 0) return;
    onPageChange(Math.min(Math.max(target, 1), pageCount));
  };

  return (
    <nav ref={ref} aria-label="Pagination" className={cn('ds-pagination', className)} {...props}>
      <button
        type="button"
        className="ds-pagination__nav"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
      >
        ‹
      </button>
      <ul className="ds-pagination__list">
        {pages.map((pageNumber) => (
          <li key={pageNumber}>
            <button
              type="button"
              aria-label={`Page ${pageNumber}`}
              aria-current={pageNumber === page ? 'page' : undefined}
              className={cn(
                'ds-pagination__item',
                pageNumber === page && 'ds-pagination__item--active',
              )}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="ds-pagination__nav"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => goTo(page + 1)}
      >
        ›
      </button>
    </nav>
  );
});
