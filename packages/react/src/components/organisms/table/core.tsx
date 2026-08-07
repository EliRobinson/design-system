import type { ChangeEvent, HTMLAttributes } from 'react';
import { useLayoutEffect, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, PaginationState, RowData, SortingState } from '@tanstack/react-table';

/**
 * Shared between the paginated `Table` and the windowed `VirtualTable`. Both
 * present the same column model, sorting, and filtering; they differ only in
 * how the row set reaches the screen, so everything up to "here are the rows"
 * lives here.
 *
 * `@tanstack/react-table` is pinned to `^8` (see package.json) so this can use
 * the real v8 top-level API — `useReactTable`, `ColumnDef<TData, TValue>`, and
 * the `get*RowModel()` factories — rather than a `@deprecated` compatibility
 * shim.
 */
export type { ColumnDef };

export const DEFAULT_ROW_HEIGHT = 44;
export const DEFAULT_VIRTUALIZE_HEIGHT = 400;

/** Props both table components accept, minus the div attributes they forward. */
export type TableBaseProps<T extends RowData> = {
  data: T[];
  columns: ColumnDef<T>[];
  /** Title shown by the EmptyState row when there are no rows to display. */
  emptyMessage?: string;
  /** Shows a built-in global filter input above the table, wired to TanStack's `getFilteredRowModel()`. */
  filterable?: boolean;
  /** Accessible label / placeholder for the built-in filter input. */
  filterPlaceholder?: string;
};

export type TableElementProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

type TableInstance<T extends RowData> = ReturnType<typeof useReactTable<T>>;
export type TableHeader<T extends RowData> = ReturnType<
  TableInstance<T>['getHeaderGroups']
>[number]['headers'][number];
export type TableRow<T extends RowData> = ReturnType<
  TableInstance<T>['getRowModel']
>['rows'][number];

export function ariaSortFor<T extends RowData>(
  header: TableHeader<T>,
): 'ascending' | 'descending' | 'none' | undefined {
  if (!header.column.getCanSort()) {
    return undefined;
  }
  const direction = header.column.getIsSorted();
  if (direction === 'asc') {
    return 'ascending';
  }
  if (direction === 'desc') {
    return 'descending';
  }
  return 'none';
}

/**
 * Builds the TanStack table instance with real row models, so
 * `getPageCount()` / `setPageIndex()` stay correct against the actual
 * filtered+sorted row count instead of hand-rolled `.slice()` math.
 */
export function useTableInstance<T extends RowData>({
  data,
  columns,
  pageSize,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  /** Omit to leave the table unpaginated (the windowed table shows every row). */
  pageSize?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize ?? 0,
  });

  const table = useReactTable<T>({
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize === undefined ? {} : { getPaginationRowModel: getPaginationRowModel() }),
  });

  return { table, pagination, setPagination, globalFilter, setGlobalFilter };
}

export function renderHeaderCell<T extends RowData>(header: TableHeader<T>) {
  if (header.isPlaceholder) {
    return null;
  }
  const content = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) {
    return content;
  }
  const direction = header.column.getIsSorted();
  return (
    <button
      type="button"
      className="ds-table__sort"
      onClick={header.column.getToggleSortingHandler()}
    >
      <span>{content}</span>
      <span className="ds-table__sort-icon" aria-hidden="true">
        {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
      </span>
    </button>
  );
}

export function TableFilterInput({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      className="ds-input ds-table__filter"
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
    />
  );
}

/**
 * Keeps `pageIndex` inside the page range as the row count shrinks.
 *
 * TanStack's `getPaginationRowModel()` does no bounds check — it is a plain
 * `rows.slice(pageIndex * pageSize, …)` — so when filtering or a shrinking
 * `data` prop leaves the current page past the end, `getRowModel().rows`
 * returns `[]` and the table renders its empty state over genuinely non-empty
 * data.
 *
 * Clamps to the last valid page rather than resetting to the first, which
 * preserves as much of the user's position as possible (deleting the last row
 * on the last page lands you on the new last page, not back at the start).
 *
 * `useLayoutEffect` so the correction lands before paint, avoiding a one-frame
 * flash of the empty state. The inequality guard means it fires once per
 * out-of-range transition and cannot loop: after `setPageIndex(max)` applies,
 * the condition is false on the next run.
 */
export function useClampedPageIndex<T extends RowData>(table: TableInstance<T>, pageIndex: number) {
  const maxPageIndex = Math.max(table.getPageCount() - 1, 0);
  useLayoutEffect(() => {
    if (pageIndex > maxPageIndex) {
      table.setPageIndex(maxPageIndex);
    }
  }, [table, pageIndex, maxPageIndex]);
}
