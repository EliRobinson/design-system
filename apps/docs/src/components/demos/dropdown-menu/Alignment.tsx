'use client';

import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@elirobinson/react/components/organisms/DropdownMenu';

const views = ['List', 'Grid', 'Board'] as const;

export default function Alignment() {
  const [view, setView] = useState<string>('List');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ds-button ds-button--secondary">
        View: {view}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel id="layout-label" inset>
          Layout
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup aria-labelledby="layout-label" value={view} onValueChange={setView}>
          {views.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {option}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem inset>Customize view…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
