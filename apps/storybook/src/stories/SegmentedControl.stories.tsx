import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl } from '@design-system/react/components/molecules/SegmentedControl';

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

function SegmentedControlDemo() {
  const [value, setValue] = useState('day');
  return <SegmentedControl options={options} value={value} onValueChange={setValue} />;
}

export const Default: Story = {
  args: { options, value: 'day', onValueChange: () => {} },
  render: () => <SegmentedControlDemo />,
};
