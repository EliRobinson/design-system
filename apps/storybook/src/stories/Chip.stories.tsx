import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from '@design-system/react/components/molecules/Chip';

const meta = {
  title: 'Components/Chip',
  component: Chip,
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Removable: Story = {
  args: { children: 'Design', onRemove: () => {} },
};

export const Static: Story = {
  args: { children: 'Read only' },
};
