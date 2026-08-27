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

function DatePickerDemo({ defaultOpen }: { defaultOpen?: boolean }) {
  const [value, setValue] = useState<Date | undefined>(SEED_DATE);
  return (
    <DatePicker
      label="Start date"
      value={value}
      onValueChange={setValue}
      defaultOpen={defaultOpen}
    />
  );
}

export const Default: Story = {
  args: { label: 'Start date', onValueChange: () => {} },
  render: () => <DatePickerDemo />,
};

/* The closed trigger above is the only state a story exercised, which left the
   whole calendar — popover surface and elevation, the month header and its
   nav buttons, the day grid, and the `--today` / `--selected` day states —
   with no baseline at all. Nothing reported that: the suite covered
   `Components/DatePicker` and the shot it took was of an input.

   `defaultOpen` renders it without an interaction. A play function that
   clicked the trigger would race the sweep's settle loop, which stops as soon
   as two consecutive captures agree — and two captures taken before the click
   agree perfectly, minting the closed picker as this story's baseline. That
   failure is silent and permanent: the baseline is then stable, so no later
   run has anything to report.

   The clock the visual suite pins (2026-01-15) is deliberately in the same
   month as SEED_DATE, so this one grid carries both the selected day and
   today. Moving either out of January would drop `--today` from the baseline
   and nothing would notice. */
export const Open: Story = {
  args: { label: 'Start date', onValueChange: () => {} },
  render: () => <DatePickerDemo defaultOpen />,
};
