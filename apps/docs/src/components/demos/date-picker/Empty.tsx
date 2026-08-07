'use client';

import { useState } from 'react';

import { DatePicker } from '@elirobinson/react/components/organisms/DatePicker';

export default function Empty() {
  const [value, setValue] = useState<Date | undefined>();

  return (
    <DatePicker
      label="First practice"
      value={value}
      onValueChange={setValue}
      className="demo-col"
    />
  );
}
