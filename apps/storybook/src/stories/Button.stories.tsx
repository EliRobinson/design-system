import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@design-system/react/components/Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Send message',
    variant: 'primary',
    size: 'md',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Accent: Story = {
  args: { variant: 'accent', children: 'Hire Me' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Browse Guides' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Learn more' },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Sold out' },
};

export const Small: Story = {
  args: { size: 'sm' },
};

export const Large: Story = {
  args: { size: 'lg' },
};
