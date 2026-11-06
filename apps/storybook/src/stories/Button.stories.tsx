import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@design-system/react/components/atoms/Button';

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

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete draft' },
};

export const DestructiveDisabled: Story = {
  args: { variant: 'destructive', disabled: true, children: 'Delete draft' },
};

export const DestructiveSizes: Story = {
  args: { variant: 'destructive', children: 'Discard changes' },
  render: (args) => (
    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
      <Button {...args} size="sm" />
      <Button {...args} size="md" />
      <Button {...args} size="lg" />
    </div>
  ),
};
