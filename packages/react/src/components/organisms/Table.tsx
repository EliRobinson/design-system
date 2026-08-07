import type { ChangeEvent, ForwardedRef, HTMLAttributes, ReactElement } from 'react';
import { forwardRef, useEffect, useState } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
} from '@tanstack/react-table/legacy';
import type { LegacyColumnDef, LegacyReactTable } from '@tanstack/react-table/legacy';
// `flexRender`, `PaginationState`, `SortingState`, and `RowData` aren't
// re-exported from the `/legacy` subpath's own barrel -- only from the main
// package (which re-exports all of `@tanstack/table-core`, per its
// `export * from "@tanstack/table-core"`, plus `flexRender` itself, which
// never moved).
import { flexRender } from '@tanstack/react-table';
import type { PaginationState, RowData, SortingState } from '@tanstack/react-table';

import { cn } from '../../lib/cn';
import { EmptyState } from '../molecules/EmptyState';
import { Pagination } from '../molecules/Pagination';
import { VirtualList } from './VirtualList';

// The package installed here is @tanstack/react-table@9, which rebuilt the
// library around an explicit, tree-shakeable `features` object rather than
// the v8 `useReactTable({ getCoreRowModel: getCoreRowModel(), ... })` shape
// the design spec/brief were written against. `useReactTable` no longer
// exists at all (the top-level hook is now `useTable`), and the top-level
// `ColumnDef<TFeatures, TData, TValue>` type has no default for `TFeatures`,
// so the single-generic `ColumnDef<Row>` usage the brief specifies does not
// compile against it.
//
// `@tanstack/react-table/legacy` is the library's own v8-compatibility
// layer: it ships `useLegacyTable`, v8-shaped `getCoreRowModel()` /
// `getSortedRowModel()` / `getFilteredRowModel()` / `getPaginationRowModel()`
// stubs, and `LegacyColumnDef<TData, TValue>` (2 generic params, matching
// the brief's `ColumnDef<Row>` usage exactly). It is marked `@deprecated` in
// favor of the new `useTable` + `features` API, but it is the only path that
// satisfies A6's literal ask (`getPaginationRowModel()` +
// `table.setPageIndex()` / `table.getPageCount()`) without redesigning this
// component against an undocumented (to this task) architecture. Aliased
// below so the rest of this file, and consumers of `Table`, never need to
// know "Legacy" is involved.
export type ColumnDef<T extends RowData> = LegacyColumnDef<T>;

const DEFAULT_ROW_HEIGHT = 44;
const DEFAULT_VIRTUALIZE_HEIGHT = 400;

export type TableProps<T extends RowData> = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  data: T[];
  columns: ColumnDef<T>[];
  /** Rows per page in the (default) paginated, non-virtualized mode. */
  pageSize?: number;
  /** Title shown by the EmptyState row when there are no rows to display. */
  emptyMessage?: string;
  /** Shows a built-in global filter input above the table, wired to TanStack's `getFilteredRowModel()`. */
  filterable?: boolean;
  /** Accessible label / placeholder for the built-in filter input. */
  filterPlaceholder?: string;
  /**
   * Opt-in windowed rendering via `VirtualList`, for large row counts.
   * Replaces the paginated `<table>` body with an ARIA `role="table"` grid
   * (see the DOM-shape note above the render branch below) and disables the
   * `Pagination` footer -- virtualization and pagination are two different
   * strategies for the same problem (rendering large row counts), so this
   * component doesn't combine them.
   */
  virtualize?: boolean;
  /** Fixed viewport height (px) for the virtualized body. Only used when `virtualize` is set. */
  virtualizeHeight?: number;
  /** Estimated/actual row height (px) for the virtualizer. Only used when `virtualize` is set. */
  rowHeight?: number;
  /** Rows to render outside the visible viewport, above and below. Forwarded to `VirtualList`. */
  overscan?: number;
};

type TableInstance<T extends RowData> = LegacyReactTable<T>;
type TableHeader<T extends RowData> = ReturnType<
  TableInstance<T>['getHeaderGroups']
>[number]['headers'][number];
type TableRow<T extends RowData> = ReturnType<TableInstance<T>['getRowModel']>['rows'][number];

function ariaSortFor<T extends RowData>(
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

// TableProps<T> is generic, and forwardRef's typings can't express a
// generic-preserving ref callback on their own -- the standard workaround
// (also used by VirtualList in this same tier) is to type the inner
// component loosely, then re-assert the generic signature on the exported
// `forwardRef` wrapper below. `ref` forwards to the component's own
// outermost element: the `.ds-table-wrapper` div, in both the paginated
// `<table>` mode and the virtualized ARIA-grid mode.
function TableInner<T extends RowData>(
  {
    data,
    columns,
    pageSize = 10,
    emptyMessage = 'No results',
    filterable = false,
    filterPlaceholder = 'Filter table',
    virtualize = false,
    virtualizeHeight = DEFAULT_VIRTUALIZE_HEIGHT,
    rowHeight = DEFAULT_ROW_HEIGHT,
    overscan,
    className,
    ...rest
  }: TableProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  // Keep the table's page size in sync with a `pageSize` prop that changes
  // after mount, resetting to page 1 so the previous pageIndex can't point
  // past the new, differently-sized set of pages.
  useEffect(() => {
    setPagination((current) =>
      current.pageSize === pageSize ? current : { pageIndex: 0, pageSize },
    );
  }, [pageSize]);

  // Per A6/C19: real TanStack row models, not hand-rolled `.slice()` +
  // manually computed `pageCount`. `getPaginationRowModel()` (registered
  // below) is what makes `table.getPageCount()` / `table.setPageIndex()`
  // correct against the actual filtered+sorted row count.
  const table = useLegacyTable<T>({
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Virtualized mode windows the full filtered+sorted row set instead of
  // paginating it (see the `virtualize` prop doc above), so it reads the
  // row model from *before* pagination slices it to one page.
  // `table.getRowModel()` is used in default mode so the empty check and
  // the rendered rows always agree, and so it's driven by the row model
  // (post filter/sort/paginate) rather than the raw `data.length` the
  // brief used -- `data.length` stays non-zero once a filter matches
  // nothing, which would silently skip the EmptyState branch (C19).
  const rows: TableRow<T>[] = virtualize
    ? table.getPrePaginatedRowModel().rows
    : table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const headerGroups = table.getHeaderGroups();
  const columnCount = table.getVisibleLeafColumns().length;

  function renderHeaderCell(header: TableHeader<T>) {
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

  function handleFilterChange(event: ChangeEvent<HTMLInputElement>) {
    setGlobalFilter(event.target.value);
  }

  const filterInput = filterable ? (
    <input
      type="search"
      className="ds-input ds-table__filter"
      aria-label={filterPlaceholder}
      placeholder={filterPlaceholder}
      value={globalFilter}
      onChange={handleFilterChange}
    />
  ) : null;

  // DOM-shape decision (see the two structural constraints in the task
  // brief): `VirtualList` renders its rows as absolutely-positioned <div>s,
  // not <tr>s, so a <tbody> full of <VirtualList> rows would be invalid
  // HTML -- browsers hoist non-<tr> children out of <tbody> during parsing.
  // Rather than ship that, virtualized mode drops the literal <table> and
  // rebuilds the table semantics with ARIA: the outer grid gets
  // `role="table"`, each header/body row gets `role="row"`, and each cell
  // gets `role="columnheader"` / `role="cell"`. Column alignment between
  // the (non-virtualized) header block and the virtualized body is done
  // with CSS grid, using the same computed `grid-template-columns` on both,
  // since the header block isn't itself inside VirtualList's windowed area.
  // Neither `{...rest}` nor any consumer prop ever lands on an element that
  // also carries an internally-computed `role`/`id`/`aria-*` (A12) -- the
  // wrapper div that receives `{...rest}` never has a hardcoded role of its
  // own in either mode; the ARIA-table root is always a separate, fully
  // internal element one level in.
  if (virtualize) {
    const gridStyle = {
      gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, minmax(0, 1fr))`,
    };

    return (
      <div ref={ref} className={cn('ds-table-wrapper', className)} {...rest}>
        {filterInput}
        <div role="table" aria-colcount={columnCount} className="ds-table ds-table--virtual">
          <div role="rowgroup">
            {headerGroups.map((headerGroup) => (
              <div
                role="row"
                key={headerGroup.id}
                className="ds-table__vrow ds-table__vrow--head"
                style={gridStyle}
              >
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-sort={ariaSortFor<T>(header)}
                    className="ds-table__vcell ds-table__vcell--head"
                  >
                    {renderHeaderCell(header)}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {isEmpty ? (
            <div role="rowgroup">
              <div role="row" className="ds-table__vrow ds-table__vrow--empty">
                <div role="cell" className="ds-table__vcell ds-table__vcell--empty">
                  <EmptyState title={emptyMessage} />
                </div>
              </div>
            </div>
          ) : (
            <VirtualList
              role="rowgroup"
              items={rows}
              estimateSize={() => rowHeight}
              height={virtualizeHeight}
              overscan={overscan}
              className="ds-table__vbody"
              renderItem={(row) => (
                <div role="row" className="ds-table__vrow" style={gridStyle}>
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} role="cell" className="ds-table__vcell">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              )}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('ds-table-wrapper', className)} {...rest}>
      {filterInput}
      <table className="ds-table">
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} aria-sort={ariaSortFor<T>(header)}>
                  {renderHeaderCell(header)}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td colSpan={columnCount}>
                <EmptyState title={emptyMessage} />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!isEmpty && table.getPageCount() > 1 ? (
        <div className="ds-table-wrapper__footer">
          <Pagination
            page={table.getState().pagination.pageIndex + 1}
            pageCount={table.getPageCount()}
            onPageChange={(page) => table.setPageIndex(page - 1)}
          />
        </div>
      ) : null}
    </div>
  );
}

export const Table = forwardRef(TableInner) as <T extends RowData>(
  props: TableProps<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReactElement | null;
