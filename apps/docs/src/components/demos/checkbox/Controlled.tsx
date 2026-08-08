'use client';

import { useState } from 'react';

import { Checkbox } from '@elirobinson/react/components/atoms/Checkbox';

const MODULES = ['Warm-up drills', 'Passing circuit', 'Small-sided game', 'Cooldown stretch'];

export default function Controlled() {
  const [selected, setSelected] = useState<string[]>(['Warm-up drills']);

  const toggle = (module: string) => {
    setSelected((current) =>
      current.includes(module) ? current.filter((item) => item !== module) : [...current, module],
    );
  };

  return (
    <div className="demo-col">
      {MODULES.map((module) => (
        <Checkbox
          key={module}
          label={module}
          checked={selected.includes(module)}
          onChange={() => toggle(module)}
        />
      ))}
      <p>
        {selected.length} of {MODULES.length} modules in this session.
      </p>
    </div>
  );
}
