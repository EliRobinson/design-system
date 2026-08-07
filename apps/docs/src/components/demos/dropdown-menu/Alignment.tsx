'use client';

import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@elirobinson/react/components/organisms/DropdownMenu';

const views = ['List', 'Grid', 'Board'] as const;

export default function Alignment() {
  const [view, setView] = useState<(typeof views)[number]>('List');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ds-button ds-button--secondary">
        View: {view}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel inset>Layout</DropdownMenuLabel>
        {views.map((option) => (
          <DropdownMenuItem key={option} inset={option !== view} onClick={() => setView(option)}>
            {option === view ? `✓ ${option}` : option}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
