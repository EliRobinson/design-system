import type { HTMLAttributes, RefObject } from 'react';
import { forwardRef, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';
import { useMergedRef } from '../../lib/useMergedRef.js';

export type PaginationProps = Omit<HTMLAttributes<HTMLElement>, 'onChange'> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

/** The most page slots (numbers and gaps) the row ever shows. */
const MAX_PAGE_SLOTS = 7;

/** Pages shown together at the start or end of a long range: every slot but
 *  the gap and the page at the far end. */
const EDGE_RUN = MAX_PAGE_SLOTS - 2;

type PageSlot = number | 'gap-start' | 'gap-end';

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(to - from + 1, 0) }, (_, index) => from + index);

/**
 * The page numbers to show, with a gap where pages are left out. Up to
 * MAX_PAGE_SLOTS pages show in full. Past that it keeps the first page, the
 * last page and the current page with one neighbour each side, so the row is
 * never more than MAX_PAGE_SLOTS slots wide. `current` must already be in range.
 */
function pageSlots(current: number, pageCount: number): PageSlot[] {
  if (pageCount <= MAX_PAGE_SLOTS) {
    return range(1, pageCount);
  }

  // 1 2 3 4 5 … N
  if (current < EDGE_RUN) {
    return [...range(1, EDGE_RUN), 'gap-end', pageCount];
  }
  // 1 … N-4 N-3 N-2 N-1 N
  if (current > pageCount - EDGE_RUN + 1) {
    return [1, 'gap-start', ...range(pageCount - EDGE_RUN + 1, pageCount)];
  }
  // 1 … p-1 p p+1 … N
  return [1, 'gap-start', current - 1, current, current + 1, 'gap-end', pageCount];
}

/**
 * Whether the row of page numbers is wider than the nav, so it should give
 * way to "Page X of Y" (#345).
 *
 * Measured rather than a container query: a size container loses its own
 * content width, so a pager in a flex row or any shrink-to-fit parent would
 * collapse to 0 wide unless every consumer gave it a width. Here the nav
 * keeps its normal sizing. The row's width is worked out from the slot count
 * and one button's width, so it can be measured while the row is hidden.
 */
function useRowTooWide(nav: RefObject<HTMLElement | null>, slotCount: number) {
  const [tooWide, setTooWide] = useState(false);

  useLayoutEffect(() => {
    const node = nav.current;
    if (!node || slotCount === 0) {
      setTooWide(false);
      return;
    }

    const measure = () => {
      const button = node.querySelector<HTMLElement>('.ds-pagination__nav');
      const list = node.querySelector<HTMLElement>('.ds-pagination__list');
      if (!button || !list) {
        return;
      }
      const target = button.offsetWidth;
      const navGap = parseFloat(getComputedStyle(node).columnGap) || 0;
      const listGap = parseFloat(getComputedStyle(list).columnGap) || 0;
      // Previous, the slots and Next, with the gaps between them.
      const rowWidth = (slotCount + 2) * target + (slotCount - 1) * listGap + 2 * navGap;
      // 1px of slack for sub-pixel rounding in offsetWidth.
      setTooWide(node.clientWidth + 1 < rowWidth);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [nav, slotCount]);

  return tooWide;
}

export const Pagination = forwardRef<HTMLElement, PaginationProps>(function Pagination(
  { className, page, pageCount, onPageChange, ...props },
  ref,
) {
  const clamp = (target: number) => Math.min(Math.max(target, 1), pageCount);
  const current = clamp(page);
  const slots = pageSlots(current, pageCount);

  const navRef = useRef<HTMLElement>(null);
  const mergedRef = useMergedRef(ref, navRef);
  const compact = useRowTooWide(navRef, slots.length);

  const goTo = (target: number) => {
    if (pageCount <= 0) return;
    onPageChange(clamp(target));
  };

  return (
    <nav
      ref={mergedRef}
      aria-label="Pagination"
      className={cn('ds-pagination', compact && 'ds-pagination--compact', className)}
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
                aria-current={slot === current ? 'page' : undefined}
                className={cn(
                  'ds-pagination__item',
                  slot === current && 'ds-pagination__item--active',
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
        // Shown instead of the numbers when the row does not fit. Hidden with
        // display, so only one of the two is ever in the accessibility tree.
        <span className="ds-pagination__summary">
          Page {current} of {pageCount}
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
