import type { Meta, StoryObj } from '@storybook/react-vite';
import { Progress } from '@design-system/react/components/Progress';

const meta = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: {
    value: 65,
    max: 100,
    label: 'Session progress',
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Complete: Story = {
  args: { value: 100 },
};
