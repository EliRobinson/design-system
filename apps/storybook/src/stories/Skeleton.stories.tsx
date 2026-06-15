import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from '@design-system/react/components/Skeleton';

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { style: { width: 240, height: 20 } },
};

export const Card: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--space-3)', width: 280 }}>
      <Skeleton style={{ height: 160 }} />
      <Skeleton style={{ height: 16, width: '80%' }} />
      <Skeleton style={{ height: 14, width: '60%' }} />
    </div>
  ),
};
