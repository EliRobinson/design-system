import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from '@design-system/react/components/Separator';

const meta = {
  title: 'Components/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
};

export const Vertical: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', height: 44, gap: 'var(--space-4)' }}>
      <span>Portfolio</span>
      <Separator orientation="vertical" />
      <span>Store</span>
    </div>
  ),
};
