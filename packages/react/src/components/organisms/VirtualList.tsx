import type { HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer } from '@tanstack/react-virtual';

import { cn } from '../../lib/cn.js';

/**
 * What a consumer can drive from outside. Deliberately not the scroll
 * container element: a row that is currently virtualized out has no DOM node
 * to scroll to, so "bring index N into view" is only answerable by the
 * virtualizer that owns the measurements. Handing out the element instead
 * would force every consumer to re-derive that from scroll offsets and
 * measured row heights, which is exactly the kind of outside-in DOM math this
 * handle exists to make unnecessary.
 */
export type VirtualListHandle = {
  scrollToIndex: Virtualizer<HTMLDivElement, Element>['scrollToIndex'];
};

export type VirtualListProps<T> = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The full, un-windowed list of items to virtualize. */
  items: T[];
  /**
   * Estimated size (px) of the row at `index`, used before it has been
   * measured. Required by the underlying virtualizer even for fixed-height
   * rows — pass a constant function (e.g. `() => 40`) in that case.
   */
  estimateSize: (index: number) => number;
  /** Renders the item at `index`. Only called for rows in the current window. */
  renderItem: (item: T, index: number) => ReactNode;
  /** Fixed height (px) of the scrollable viewport. */
  height: number;
  /** Extra rows to render outside the visible viewport, above and below. */
  overscan?: number;
};

function VirtualListInner<T>(
  {
    items,
    estimateSize,
    renderItem,
    height,
    overscan = 5,
    className,
    style,
    ...props
  }: VirtualListProps<T>,
  ref: Ref<VirtualListHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan,
  });

  useImperativeHandle(ref, () => ({ scrollToIndex: virtualizer.scrollToIndex }), [virtualizer]);

  return (
    <div
      ref={containerRef}
      className={cn('ds-virtual-list', className)}
      style={{ ...style, height, overflow: 'auto' }}
      {...props}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="ds-virtual-list__row"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Windowed list that only renders the rows currently within (or near) its
 * viewport, backed by `@tanstack/react-virtual`. Intended to be composed by
 * `Table` (opt-in `virtualize` prop) and `Combobox` (long option lists) —
 * see the props above for what those consumers need: `height` (container
 * height), `estimateSize` (row height estimate), `overscan`, and
 * `renderItem` (render an arbitrary item by index).
 *
 * The forwarded ref resolves to a {@link VirtualListHandle}, not the scroll
 * container element.
 */
export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => ReactElement | null;
