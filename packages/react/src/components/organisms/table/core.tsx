import type { ChangeEvent, HTMLAttributes } from 'react';
import { useLayoutEffect, useState } from 'react';
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type {
  CellData,
  ColumnDef as TanStackColumnDef,
  PaginationState,
  ReactTable,
  RowData,
  SortingState,
} from '@tanstack/react-table';

/**
 * Shared between the paginated `Table` and the windowed `VirtualTable`. Both
 * present the same column model, sorting, and filtering; they differ only in
 * how the row set reaches the screen, so everything up to "here are the rows"
 * lives here.
 *
 * `@tanstack/react-table` is on `^9` (see package.json), so this uses the real
 * v9 top-level API — `useTable`, `tableFeatures()`, and the `create*RowModel()`
 * factories — rather than the `@deprecated` `/legacy` v8 compatibility shim.
 */

/**
 * The one feature set both table components are built from.
 *
 * v9 is opt-in per feature: an API only exists on the table instance when its
 * feature is registered here, and the row-model factories are registered
 * alongside the feature they belong to (`sortedRowModel` needs
 * `rowSortingFeature`, `filteredRowModel` needs `columnFilteringFeature`,
 * `paginatedRowModel` needs `rowPaginationFeature`). Every entry below is load
 * bearing:
 *
 * - `columnVisibilityFeature` — `table.getVisibleLeafColumns()` (the
 *   EmptyState `colSpan`) and `row.getVisibleCells()` come from it.
 * - `columnFilteringFeature` — required by `globalFilteringFeature`, and owns
 *   the filtered row model the built-in filter input drives.
 * - `globalFilteringFeature` — the `filterable` prop's single search box.
 * - `rowSortingFeature` — sortable headers.
 * - `rowPaginationFeature` — `Table`'s pager. `VirtualTable` registers the
 *   same feature but opts out of the row model with `manualPagination`.
 *
 * Deliberately *not* `stockFeatures`: that pulls every built-in feature
 * (grouping, pinning, resizing, row/cell selection, faceting, expanding) into
 * every consumer's bundle to power APIs neither component calls. The migration
 * guide calls `stockFeatures` a parity-audit aid, not production architecture.
 *
 * Built statically at module scope, as `tableFeatures()` documents — it is
 * identity-compared by the table instance, so a per-render object would
 * rebuild the table on every render.
 */
export const tableFeatureSet = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  // The three names `column_getAutoSortFn` can resolve to for an untyped
  // column (`sortFn: 'auto'`, the default). Registering exactly these keeps
  // automatic sorting warning-free without bundling the rest of the registry;
  // anything else auto might pick falls back to `sortFn_basic` internally.
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type TableFeatureSet = typeof tableFeatureSet;

// v9's `ColumnDef` takes the feature set as its first generic. Consumers
// should not have to name ours, so the published type keeps the
// `ColumnDef<Row>` shape it had under v8 and pins `TFeatures` internally.
//
// Deliberately a `//` comment, not JSDoc: the manifest generator treats a
// doc-commented exported declaration as a documented sub-component, and this
// note is an implementation detail rather than consumer-facing API docs.
export type ColumnDef<T extends RowData, TValue extends CellData = CellData> = TanStackColumnDef<
  TableFeatureSet,
  T,
  TValue
>;

export const DEFAULT_ROW_HEIGHT = 44;
export const DEFAULT_VIRTUALIZE_HEIGHT = 400;

/** Props both table components accept, minus the div attributes they forward. */
export type TableBaseProps<T extends RowData> = {
  data: T[];
  columns: ColumnDef<T>[];
  /** Title shown by the EmptyState row when there are no rows to display. */
  emptyMessage?: string;
  /** Shows a built-in global filter input above the table, wired to TanStack's filtered row model. */
  filterable?: boolean;
  /** Accessible label / placeholder for the built-in filter input. */
  filterPlaceholder?: string;
};

export type TableElementProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

type TableInstance<T extends RowData> = ReactTable<TableFeatureSet, T>;
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
 *
 * State stays controlled by React (`state` + `on*Change`) rather than living
 * in v9's internal store, so the component can read `pagination` and
 * `globalFilter` directly. v9 dropped `table.getState()`, and the store-backed
 * `table.state` is a projection of the same values, so owning them here keeps
 * one source of truth for the pager and the clamp effect below.
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

  const table = useTable<TableFeatureSet, T>({
    features: tableFeatureSet,
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    // The paginated row model is registered for both components, so the
    // unpaginated one has to opt out explicitly: `manualPagination` makes
    // `getRowModel()` return the pre-paginated rows untouched. Without it the
    // row model would slice `pageSize * pageIndex`, and the sentinel
    // `pageSize: 0` above would slice every row away.
    manualPagination: pageSize === undefined,
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
 * TanStack's paginated row model does no bounds check — it is a plain
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
