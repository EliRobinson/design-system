'use client';

import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@elirobinson/react/components/organisms/DropdownMenu';

export default function Checkable() {
  const [showAges, setShowAges] = useState(true);
  const [showDrills, setShowDrills] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ds-button ds-button--secondary">Columns</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel inset>Show in the table</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={showAges} onCheckedChange={setShowAges}>
          Age group
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={showDrills} onCheckedChange={setShowDrills}>
          Drill count
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked disabled>
          Title
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
