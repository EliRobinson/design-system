'use client';

import { useState } from 'react';

import { Combobox } from '@elirobinson/react/components/organisms/Combobox';

const sports = [
  'Soccer',
  'Basketball',
  'Baseball',
  'Softball',
  'Track',
  'Swimming',
  'Volleyball',
  'Tennis',
  'Golf',
  'Cross country',
  'Wrestling',
  'Lacrosse',
  'Field hockey',
  'Rugby',
];

const drills = sports.flatMap((sport) =>
  Array.from({ length: 40 }, (_, index) => ({
    label: `${sport} — drill ${index + 1}`,
    value: `${sport.toLowerCase().replace(/\s+/g, '-')}-${index + 1}`,
  })),
);

export default function LongList() {
  const [value, setValue] = useState<string | undefined>();

  return (
    <Combobox
      label="Drill"
      options={drills}
      value={value}
      onValueChange={setValue}
      className="demo-col"
    />
  );
}
