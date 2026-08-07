import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnDef } from '@design-system/react/components/organisms/Table';
import { Table } from '@design-system/react/components/organisms/Table';

type Row = { id: number; name: string; role: string };

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
];

const data: Row[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  name: `User ${index + 1}`,
  role: index % 2 === 0 ? 'Admin' : 'Member',
}));

const largeData: Row[] = Array.from({ length: 500 }, (_, index) => ({
  id: index + 1,
  name: `User ${index + 1}`,
  role: index % 2 === 0 ? 'Admin' : 'Member',
}));

// `Table<T>` is generic (`T extends RowData`), and `satisfies Meta<typeof
// Table>` has to collapse that generic to a single concrete props type --
// `ColumnDef<Row>[]` is not assignable to whatever `ColumnDef<T>[]` the
// collapsed type expects (`ColumnDef` is not covariant in `TData`), the same
// issue VirtualList's story hit (Task 14). Each story below supplies
// realistic `args` (required by B3) and does the actual rendering through
// `render`, which calls the properly-typed `Table<Row>` directly rather than
// through the collapsed `meta.component` type.
function TableDemo() {
  return <Table data={data} columns={columns} pageSize={10} />;
}

function TableEmptyDemo() {
  return <Table data={[]} columns={columns} emptyMessage="No users yet" />;
}

function TableSortableFilterableDemo() {
  return (
    <Table data={data} columns={columns} pageSize={8} filterable filterPlaceholder="Filter users" />
  );
}

function TableVirtualizedDemo() {
  return (
    <Table
      data={largeData}
      columns={columns}
      virtualize
      virtualizeHeight={400}
      rowHeight={44}
      filterable
    />
  );
}

const meta = {
  title: 'Components/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data, columns, pageSize: 10 } as Story['args'],
  render: () => <TableDemo />,
};

export const Empty: Story = {
  args: { data: [], columns, emptyMessage: 'No users yet' } as Story['args'],
  render: () => <TableEmptyDemo />,
};

export const SortableAndFilterable: Story = {
  args: { data, columns, pageSize: 8, filterable: true } as Story['args'],
  render: () => <TableSortableFilterableDemo />,
};

export const Virtualized: Story = {
  args: { data: largeData, columns, virtualize: true, virtualizeHeight: 400 } as Story['args'],
  render: () => <TableVirtualizedDemo />,
};
