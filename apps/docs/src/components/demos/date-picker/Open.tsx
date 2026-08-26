'use client';

import { useState } from 'react';

import { DatePicker } from '@elirobinson/react/components/organisms/DatePicker';

/* The month is in the past deliberately. `today` is read at render, so a
   prerendered page bakes the *build* machine's date into the grid and keeps it
   until the first client re-render — a calendar opened on a month that cannot
   contain a build date never shows a stale marker. */
const SEED_DATE = new Date(2026, 0, 8);

export default function Open() {
  const [value, setValue] = useState<Date | undefined>(SEED_DATE);

  return (
    /* The popover is positioned absolutely, so it takes up no space of its own
       and paints over whatever follows it. Reserve the room instead: a
       six-week month is the tallest the calendar gets, at just over 300px
       here, so the layout does not shift as you page through months. */
    <div style={{ minHeight: 320 }}>
      <DatePicker
        label="Session date"
        value={value}
        onValueChange={setValue}
        defaultOpen
        className="demo-col"
      />
    </div>
  );
}
