import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '@design-system/react/components/molecules/EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'No results found',
    description: 'Try adjusting your filters or search term.',
  },
};
