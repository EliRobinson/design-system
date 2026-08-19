import type { Meta, StoryObj } from '@storybook/react-vite';
import { StreamingCaret } from '@design-system/react/components/ai/StreamingCaret';

const meta = {
  title: 'Components/StreamingCaret',
  component: StreamingCaret,
  tags: ['autodocs'],
} satisfies Meta<typeof StreamingCaret>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <p className="t-body">
      Checking the last three invoices <StreamingCaret />
    </p>
  ),
};

export const Labelled: Story = {
  args: { label: 'Still writing' },
  render: () => (
    <p className="t-body">
      Checking the last three invoices <StreamingCaret label="Still writing" />
    </p>
  ),
};
