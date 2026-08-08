'use client';

import { useState } from 'react';

import { RadioGroup, RadioGroupItem } from '@elirobinson/react/components/atoms/RadioGroup';

export default function Controlled() {
  const [duration, setDuration] = useState('60');

  return (
    <div className="demo-col">
      <RadioGroup name="session-length" value={duration} onValueChange={setDuration}>
        <RadioGroupItem value="30" label="30 minutes" />
        <RadioGroupItem value="60" label="60 minutes" />
        <RadioGroupItem value="90" label="90 minutes" />
      </RadioGroup>
      <p>Booking a {duration}-minute session.</p>
    </div>
  );
}
