import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ColumnDef } from './Table.js';
import { VirtualTable } from './VirtualTable.js';
import { stubViewportLayout } from '../../test/viewport.js';

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

describe('VirtualTable', () => {
  stubViewportLayout();

  it('renders an ARIA table/row/cell grid instead of a literal <table> in virtualized mode, and windows the rows', () => {
    render(<VirtualTable data={makeRows(200)} columns={columns} height={200} rowHeight={40} />);

    // Positive fact: ARIA table semantics are present.
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').length).toBe(columns.length);
    // Positive fact: no literal <table> element was used (VirtualList rows
    // are <div>s, which are invalid inside a real <tbody>).
    expect(document.querySelector('table')).not.toBeInTheDocument();

    // Positive fact: the first row is present.
    expect(screen.getByRole('cell', { name: 'Row 1' })).toBeInTheDocument();
    // Positive fact: a far-off row is not -- proves this is windowed
    // rendering, not all 200 rows dumped into the DOM (which a weaker test
    // asserting only "some rows render" would miss).
    expect(screen.queryByRole('cell', { name: 'Row 200' })).not.toBeInTheDocument();
  });

  it('renders the EmptyState row (not a broken grid) when virtualized with no matching rows', () => {
    render(<VirtualTable data={[]} columns={columns} emptyMessage="No rows yet" />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('No rows yet')).toBeInTheDocument();
  });
});
