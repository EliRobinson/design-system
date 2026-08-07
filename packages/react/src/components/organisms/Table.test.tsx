import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ColumnDef } from './Table';
import { Table } from './Table';

type Row = { id: number; name: string };

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Row ${index + 1}`,
  }));
}

describe('Table', () => {
  it('renders column headers and row data', () => {
    render(<Table data={[{ id: 1, name: 'Ada' }]} columns={columns} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
  });

  it('renders EmptyState when there is no data, and still passes className through', () => {
    render(
      <Table data={[]} columns={columns} emptyMessage="No rows yet" className="custom-table" />,
    );

    expect(screen.getByText('No rows yet')).toBeInTheDocument();
    // An early-return empty branch can easily drop `className` entirely --
    // this checks the wrapper actually carries it on the empty-state path,
    // not just on the happy path.
    expect(document.querySelector('.ds-table-wrapper.custom-table')).toBeInTheDocument();
  });

  it('paginates via TanStack row models: page 1 and the last page show different, correct rows', () => {
    render(<Table data={makeRows(25)} columns={columns} pageSize={10} />);

    // Page 1 == TanStack pageIndex 0. Boundary #1 of the 1-indexed/0-indexed
    // conversion: row 1 and row 10 are present, row 11 (first row of the
    // *next* page) is not.
    expect(screen.getByRole('cell', { name: 'Row 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Row 10' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Row 11' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();

    // 25 rows / pageSize 10 = 3 pages (ceil). Jump to the last page --
    // boundary #2: page 3 == TanStack pageIndex 2, and it holds the
    // remaining 5 rows (21-25), not a full 10.
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(screen.getByRole('cell', { name: 'Row 21' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Row 25' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Row 20' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
    // Disabled "Next" on page 3 proves pageCount was computed as
    // ceil(25/10)=3 by the real TanStack pagination row model, not a
    // hand-rolled off-by-one that would leave a phantom 4th page.
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('sorts rows by clicking a sortable column header, reordering the actual cell text', () => {
    render(
      <Table
        data={[
          { id: 3, name: 'Carol' },
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ]}
        columns={columns}
      />,
    );

    const bodyRowsInitial = screen.getAllByRole('row').slice(1);
    expect(within(bodyRowsInitial[0]).getByText('Carol')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));

    const bodyRowsAscending = screen.getAllByRole('row').slice(1);
    expect(within(bodyRowsAscending[0]).getByText('Alice')).toBeInTheDocument();
    expect(within(bodyRowsAscending[1]).getByText('Bob')).toBeInTheDocument();
    expect(within(bodyRowsAscending[2]).getByText('Carol')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Name' }));

    const bodyRowsDescending = screen.getAllByRole('row').slice(1);
    expect(within(bodyRowsDescending[0]).getByText('Carol')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('renders EmptyState when filtering matches no rows, keyed off the row model rather than raw data length', () => {
    render(<Table data={makeRows(5)} columns={columns} filterable emptyMessage="Nothing found" />);

    expect(screen.getByRole('cell', { name: 'Row 1' })).toBeInTheDocument();
    expect(screen.queryByText('Nothing found')).not.toBeInTheDocument();

    // `data` still has 5 rows -- only the *filtered* row model is empty.
    // Checking `data.length` instead would never fire
    // this branch.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz-no-match' } });

    expect(screen.getByText('Nothing found')).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Row 1' })).not.toBeInTheDocument();

    // Clearing the filter brings real rows back -- proves the empty state
    // isn't a permanent/stuck render.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(screen.getByRole('cell', { name: 'Row 1' })).toBeInTheDocument();
  });

  it('clamps to the last valid page when a shrinking `data` set leaves the current page out of range', () => {
    const { rerender } = render(<Table data={makeRows(25)} columns={columns} pageSize={10} />);

    // Navigate to page 3 (TanStack pageIndex 2) of the original 25-row set.
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(screen.getByRole('cell', { name: 'Row 21' })).toBeInTheDocument();

    // Simulate an external filter/search narrowing the dataset to 5 rows --
    // fewer than fit on a single page -- while the table is still sitting
    // on page 3. `getPaginationRowModel()` has no bounds-check of its own
    // (a plain `.slice(pageStart, pageEnd)`), so without the clamp effect
    // `table.getRowModel().rows` would slice past the end of the new
    // 5-row set and come back empty.
    rerender(<Table data={makeRows(5)} columns={columns} pageSize={10} />);

    // Real, non-empty rows are visible on the (now only) valid page ...
    expect(screen.getByRole('cell', { name: 'Row 1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Row 5' })).toBeInTheDocument();
    // ... and the EmptyState did NOT fire for genuinely non-empty data.
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
    expect(document.querySelector('.ds-empty-state')).not.toBeInTheDocument();
    // With only 5 rows at pageSize 10 there's exactly one page, so the
    // Pagination footer (which only renders when pageCount > 1) is gone
    // entirely -- a further check that the table landed on a real, valid
    // page rather than merely not crashing.
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('still renders EmptyState for genuinely empty data after a shrink (the clamp does not suppress the real empty case)', () => {
    const { rerender } = render(<Table data={makeRows(25)} columns={columns} pageSize={10} />);

    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(screen.getByRole('cell', { name: 'Row 21' })).toBeInTheDocument();

    // Shrink all the way to zero rows -- unlike the previous test, there is
    // no valid page with real rows on it, so the empty state must still
    // fire; the clamp effect must not paper over a genuinely empty result.
    rerender(<Table data={[]} columns={columns} pageSize={10} emptyMessage="Nothing left" />);

    expect(screen.getByText('Nothing left')).toBeInTheDocument();
    // Exactly one cell -- the `colSpan` wrapper around EmptyState (the
    // `<tr><td colSpan><EmptyState /></td></tr>` structure) -- not a row of
    // real data cells.
    expect(screen.getAllByRole('cell')).toHaveLength(1);
    expect(screen.queryByRole('cell', { name: 'Row 21' })).not.toBeInTheDocument();
  });
});
