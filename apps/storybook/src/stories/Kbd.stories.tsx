import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from '@design-system/react/components/atoms/Kbd';

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShortcutHint: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 4 }}>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </div>
  ),
};
