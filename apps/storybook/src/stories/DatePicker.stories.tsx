import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DatePicker } from '@design-system/react/components/organisms/DatePicker';

const meta = {
  title: 'Components/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

function DatePickerDemo() {
  const [value, setValue] = useState<Date | undefined>(new Date());
  return <DatePicker label="Start date" value={value} onValueChange={setValue} />;
}

export const Default: Story = {
  args: { label: 'Start date', onValueChange: () => {} },
  render: () => <DatePickerDemo />,
};
