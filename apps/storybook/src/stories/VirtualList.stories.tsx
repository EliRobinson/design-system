import type { Meta, StoryObj } from '@storybook/react-vite';
import { VirtualList } from '@design-system/react/components/organisms/VirtualList';

const meta = {
  title: 'Components/VirtualList',
  component: VirtualList,
  tags: ['autodocs'],
} satisfies Meta<typeof VirtualList>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = Array.from({ length: 1000 }, (_, index) => `Row ${index + 1}`);

export const Default: Story = {
  args: {
    items,
    estimateSize: () => 40,
    renderItem: (item: unknown) => <span>{String(item)}</span>,
    height: 320,
  },
  render: () => (
    <VirtualList
      items={items}
      estimateSize={() => 40}
      height={320}
      renderItem={(item) => <span>{item}</span>}
    />
  ),
};
