'use client';

import { useState } from 'react';

import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@elirobinson/react/components/organisms/Popover';

const sports = ['All sports', 'Soccer', 'Basketball', 'Track'];

export default function Controlled() {
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState('All sports');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="ds-button ds-button--secondary">Filter: {sport}</PopoverTrigger>
      <PopoverContent>
        <div className="demo-col">
          {sports.map((option) => (
            <Button
              key={option}
              variant={option === sport ? 'primary' : 'ghost'}
              onClick={() => setSport(option)}
            >
              {option}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
