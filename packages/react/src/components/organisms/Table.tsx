import type { ForwardedRef, ReactElement } from 'react';
import { forwardRef, useEffect } from 'react';
import type { RowData } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';

import { cn } from '../../lib/cn';
import { EmptyState } from '../molecules/EmptyState';
import { Pagination } from '../molecules/Pagination';
import {
  TableFilterInput,
  ariaSortFor,
  renderHeaderCell,
  useClampedPageIndex,
  useTableInstance,
} from './table/core';
import type { TableBaseProps, TableElementProps } from './table/core';

export type { ColumnDef } from './table/core';

export type TableProps<T extends RowData> = TableElementProps &
  TableBaseProps<T> & {
    /** Rows per page. */
    pageSize?: number;
  };

// TableProps<T> is generic, and forwardRef's typings cannot express a
// generic-preserving ref callback on their own. The standard workaround (also
// used by VirtualList) is to type the inner component loosely, then re-assert
// the generic signature on the exported `forwardRef` wrapper below. `ref`
// forwards to the outermost `.ds-table-wrapper` div, which never carries an
// internally computed role/id/aria-*, so `{...rest}` cannot clobber any.
function TableInner<T extends RowData>(
  {
    data,
    columns,
    pageSize = 10,
    emptyMessage = 'No results',
    filterable = false,
    filterPlaceholder = 'Filter table',
    className,
    ...rest
  }: TableProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { table, pagination, setPagination, globalFilter, setGlobalFilter } = useTableInstance({
    data,
    columns,
    pageSize,
  });

  // Keep the page size in sync with a `pageSize` prop that changes after
  // mount, resetting to page 1 so the previous pageIndex cannot point past the
  // new, differently sized set of pages.
  useEffect(() => {
    setPagination((current) =>
      current.pageSize === pageSize ? current : { pageIndex: 0, pageSize },
    );
  }, [pageSize, setPagination]);

  useClampedPageIndex(table, pagination.pageIndex);

  // Read from the row model (post filter/sort/paginate) rather than
  // `data.length`, so the empty check and the rendered rows always agree —
  // `data.length` stays non-zero once a filter matches nothing, which would
  // silently skip the EmptyState branch.
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const columnCount = table.getVisibleLeafColumns().length;

  return (
    <div ref={ref} className={cn('ds-table-wrapper', className)} {...rest}>
      {filterable ? (
        <TableFilterInput
          value={globalFilter}
          onValueChange={setGlobalFilter}
          placeholder={filterPlaceholder}
        />
      ) : null}
      <table className="ds-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} aria-sort={ariaSortFor<T>(header)}>
                  {renderHeaderCell<T>(header)}
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
            // v9 removed `table.getState()`; `pagination` is the controlled
            // state this component already owns, and is the same value the
            // row model paginated with. TanStack's `pageIndex` is 0-indexed
            // and `Pagination` is 1-indexed, hence the +1 here and the -1 on
            // the way back.
            page={pagination.pageIndex + 1}
            pageCount={table.getPageCount()}
            onPageChange={(page) => table.setPageIndex(page - 1)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Paginated data table backed by `@tanstack/react-table`'s row models.
 *
 * For large row counts, use `VirtualTable` instead — windowing and pagination
 * are two strategies for the same problem, so neither component combines them.
 */
export const Table = forwardRef(TableInner) as <T extends RowData>(
  props: TableProps<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReactElement | null;
