import type { Meta, StoryObj } from '@storybook/react-vite';
import { VerdictBadge } from '@design-system/react/components/molecules/VerdictBadge';

const meta = {
  title: 'Components/VerdictBadge',
  component: VerdictBadge,
  tags: ['autodocs'],
  args: {
    verdict: 'go',
    label: 'Go',
  },
} satisfies Meta<typeof VerdictBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Go: Story = {
  args: {
    verdict: 'go',
    label: 'Worth it',
  },
};

export const No: Story = {
  args: {
    verdict: 'no',
    label: 'Not worth it',
  },
};

export const Hold: Story = {
  args: {
    verdict: 'hold',
    label: 'Wait a week',
  },
};
