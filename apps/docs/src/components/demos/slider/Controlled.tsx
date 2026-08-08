'use client';

import { useState } from 'react';

import { Slider } from '@elirobinson/react/components/atoms/Slider';

export default function Controlled() {
  const [minutes, setMinutes] = useState(45);

  return (
    <div className="demo-col">
      <Slider
        label="Session length"
        min={15}
        max={90}
        step={15}
        value={minutes}
        onChange={(event) => setMinutes(Number(event.target.value))}
      />
      <p>{minutes} minutes per session.</p>
    </div>
  );
}
