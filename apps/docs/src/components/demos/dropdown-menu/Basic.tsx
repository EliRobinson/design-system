'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@elirobinson/react/components/organisms/DropdownMenu';

export default function Basic() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ds-button ds-button--secondary">
        Guide actions
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>U8 Soccer Season Plan</DropdownMenuLabel>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
