import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnDef } from '@design-system/react/components/organisms/VirtualTable';
import { VirtualTable } from '@design-system/react/components/organisms/VirtualTable';

type Row = { id: number; name: string; role: string };

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
];

const largeData: Row[] = Array.from({ length: 500 }, (_, index) => ({
  id: index + 1,
  name: `User ${index + 1}`,
  role: index % 2 === 0 ? 'Admin' : 'Member',
}));

// `VirtualTable<T>` is generic, and `satisfies Meta<typeof VirtualTable>` has
// to collapse that generic to a single concrete props type. Each story supplies
// realistic `args` and renders through `render`, which calls the properly-typed
// `VirtualTable<Row>` directly -- same pattern as Table.stories.tsx.
function VirtualTableDemo() {
  return <VirtualTable data={largeData} columns={columns} height={400} rowHeight={44} filterable />;
}

const meta = {
  title: 'Components/VirtualTable',
  component: VirtualTable,
} satisfies Meta<typeof VirtualTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data: largeData, columns, height: 400, rowHeight: 44 } as Story['args'],
  render: () => <VirtualTableDemo />,
};
