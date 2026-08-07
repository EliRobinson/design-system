'use client';

import { useState } from 'react';

import { SegmentedControl } from '@elirobinson/react/components/molecules/SegmentedControl';

const options = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

export default function Basic() {
  const [value, setValue] = useState('week');

  return <SegmentedControl options={options} value={value} onValueChange={setValue} />;
}
