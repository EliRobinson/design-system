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

/* Pinned rather than `new Date()`. The field renders the selected date as
   text, so a live clock changed this story's output every single day: a visual
   baseline taken from it would rot overnight (issue #65), and nobody reviewing
   the story by eye could tell an intended change from the calendar advancing.

   The visual suite additionally freezes the clock, which covers the `today`
   marker the component derives internally — but that only applies under
   Playwright. A story should be reproducible on its own. */
const SEED_DATE = new Date(2026, 0, 8);

function DatePickerDemo() {
  const [value, setValue] = useState<Date | undefined>(SEED_DATE);
  return <DatePicker label="Start date" value={value} onValueChange={setValue} />;
}

export const Default: Story = {
  args: { label: 'Start date', onValueChange: () => {} },
  render: () => <DatePickerDemo />,
};
