'use client';

import { useState } from 'react';

import { DatePicker } from '@elirobinson/react/components/organisms/DatePicker';

export default function Basic() {
  const [value, setValue] = useState<Date | undefined>(new Date(2026, 7, 15));

  return (
    <DatePicker label="Session date" value={value} onValueChange={setValue} className="demo-col" />
  );
}
