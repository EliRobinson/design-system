'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@elirobinson/react/components/organisms/Popover';

export default function Basic() {
  return (
    <Popover>
      <PopoverTrigger className="ds-button ds-button--secondary">
        What&apos;s included?
      </PopoverTrigger>
      <PopoverContent>
        <p>Every coaching guide ships as a versioned PDF plus a printable practice-plan card.</p>
      </PopoverContent>
    </Popover>
  );
}
