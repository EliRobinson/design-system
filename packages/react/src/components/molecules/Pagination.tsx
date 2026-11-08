import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';

export type PaginationProps = Omit<HTMLAttributes<HTMLElement>, 'onChange'> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

/** The most page slots (numbers and gaps) the row ever shows. Pagination.css
 *  has one container rule per slot count up to this, so keep the two in step. */
const MAX_PAGE_SLOTS = 7;

type PageSlot = number | 'gap-start' | 'gap-end';

/**
 * The page numbers to show, with a gap where pages are left out. Up to
 * MAX_PAGE_SLOTS pages show in full. Past that it keeps the first page, the
 * last page and the current page with one neighbour each side, so the row is
 * never more than MAX_PAGE_SLOTS slots wide.
 */
function pageSlots(page: number, pageCount: number): PageSlot[] {
  if (pageCount <= MAX_PAGE_SLOTS) {
    return Array.from({ length: Math.max(pageCount, 0) }, (_, index) => index + 1);
  }

  const current = Math.min(Math.max(page, 1), pageCount);
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);

  // 1 2 3 4 5 … N
  if (current <= 4) {
    return [...range(1, 5), 'gap-end', pageCount];
  }
  // 1 … N-4 N-3 N-2 N-1 N
  if (current >= pageCount - 3) {
    return [1, 'gap-start', ...range(pageCount - 4, pageCount)];
  }
  // 1 … p-1 p p+1 … N
  return [1, 'gap-start', current - 1, current, current + 1, 'gap-end', pageCount];
}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  { className, page, pageCount, onPageChange, ...props },
  ref,
) {
  const slots = pageSlots(page, pageCount);
  const goTo = (target: number) => {
    if (pageCount <= 0) return;
    onPageChange(Math.min(Math.max(target, 1), pageCount));
  };

  return (
    <nav
      ref={ref}
      aria-label="Pagination"
      className={cn('ds-pagination', className)}
      // Read by Pagination.css: it picks the width below which the row of
      // numbers gives way to "Page X of Y".
      data-slots={slots.length}
      {...props}
    >
      <button
        type="button"
        className="ds-pagination__nav"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
      >
        <Mark name="chevron-left" />
      </button>
      <ul className="ds-pagination__list">
        {slots.map((slot) =>
          typeof slot === 'number' ? (
            <li key={slot}>
              <button
                type="button"
                aria-label={`Page ${slot}`}
                aria-current={slot === page ? 'page' : undefined}
                className={cn(
                  'ds-pagination__item',
                  slot === page && 'ds-pagination__item--active',
                )}
                onClick={() => onPageChange(slot)}
              >
                {slot}
              </button>
            </li>
          ) : (
            // The buttons either side name their own pages, so the gap is
            // only drawn, not read out.
            <li key={slot} className="ds-pagination__gap" aria-hidden="true">
              …
            </li>
          ),
        )}
      </ul>
      {pageCount > 0 ? (
        // Shown instead of the numbers when the row does not fit (see
        // Pagination.css). Hidden with display, so only one of the two is
        // ever in the accessibility tree.
        <span className="ds-pagination__summary">
          Page {Math.min(Math.max(page, 1), pageCount)} of {pageCount}
        </span>
      ) : null}
      <button
        type="button"
        className="ds-pagination__nav"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => goTo(page + 1)}
      >
        <Mark name="chevron-right" />
      </button>
    </nav>
  );
});
