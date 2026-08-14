import type { ForwardedRef, ReactElement } from 'react';
import { forwardRef } from 'react';
import type { RowData } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';

import { cn } from '../../lib/cn.js';
import { EmptyState } from '../molecules/EmptyState.js';
import { VirtualList } from './VirtualList.js';
import {
  DEFAULT_ROW_HEIGHT,
  DEFAULT_VIRTUALIZE_HEIGHT,
  TableFilterInput,
  ariaSortFor,
  renderHeaderCell,
  useTableInstance,
} from './table/core.js';
import type { TableBaseProps, TableElementProps } from './table/core.js';

export type { ColumnDef } from './table/core.js';

export type VirtualTableProps<T extends RowData> = TableElementProps &
  TableBaseProps<T> & {
    /** Fixed viewport height (px) for the windowed body. */
    height?: number;
    /** Estimated/actual row height (px) for the virtualizer. */
    rowHeight?: number;
    /** Rows to render outside the visible viewport, above and below. */
    overscan?: number;
  };

// `VirtualList` renders its rows as absolutely positioned <div>s, not <tr>s,
// and a <tbody> full of non-<tr> children is invalid HTML — browsers hoist
// them out during parsing. So this rebuilds table semantics with ARIA instead
// of shipping a broken <table>: `role="table"` on the grid, `role="row"` per
// row, `role="columnheader"` / `role="cell"` per cell. Column alignment
// between the (unwindowed) header block and the windowed body is done with the
// same computed `grid-template-columns` on both.
//
// Neither `{...rest}` nor any consumer prop lands on an element carrying an
// internally computed role/id/aria-*: the wrapper div that receives `{...rest}`
// has no hardcoded role, and the ARIA-table root is a separate internal
// element one level in.
function VirtualTableInner<T extends RowData>(
  {
    data,
    columns,
    emptyMessage = 'No results',
    filterable = false,
    filterPlaceholder = 'Filter table',
    height = DEFAULT_VIRTUALIZE_HEIGHT,
    rowHeight = DEFAULT_ROW_HEIGHT,
    overscan,
    className,
    ...rest
  }: VirtualTableProps<T>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { table, globalFilter, setGlobalFilter } = useTableInstance({ data, columns });

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const columnCount = table.getVisibleLeafColumns().length;
  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, minmax(0, 1fr))`,
  };

  return (
    <div ref={ref} className={cn('ds-table-wrapper', className)} {...rest}>
      {filterable ? (
        <TableFilterInput
          value={globalFilter}
          onValueChange={setGlobalFilter}
          placeholder={filterPlaceholder}
        />
      ) : null}
      <div role="table" aria-colcount={columnCount} className="ds-table ds-table--virtual">
        <div role="rowgroup">
          {table.getHeaderGroups().map((headerGroup) => (
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
                  {renderHeaderCell<T>(header)}
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
            height={height}
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

/**
 * Data table that windows its rows instead of paginating them, for large row
 * counts. Same column model, sorting, and filtering as `Table`; use that one
 * when pagination is the better fit.
 */
export const VirtualTable = forwardRef(VirtualTableInner) as <T extends RowData>(
  props: VirtualTableProps<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReactElement | null;
