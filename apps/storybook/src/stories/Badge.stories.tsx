import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@design-system/react/components/atoms/Badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    children: 'Food',
    variant: 'default',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Signal: Story = { args: { variant: 'signal', children: 'Featured' } };
export const Anchor: Story = { args: { variant: 'anchor', children: 'Coaching' } };
export const Solid: Story = { args: { variant: 'solid', children: 'New' } };
export const Outline: Story = { args: { variant: 'outline', children: 'Beta' } };
