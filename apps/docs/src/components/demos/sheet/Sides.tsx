'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@elirobinson/react/components/organisms/Sheet';

const SIDES = ['left', 'right', 'top', 'bottom'] as const;

function SideSheet({ side }: { side: (typeof SIDES)[number] }) {
  const [open, setOpen] = useState(false);
  const label = side.charAt(0).toUpperCase() + side.slice(1);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="ds-button ds-button--secondary">{label}</SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Opens from the {side}</SheetTitle>
          <SheetDescription>
            Set side=&quot;{side}&quot; on SheetContent to slide in from this edge.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function Sides() {
  return (
    <div className="demo-row">
      {SIDES.map((side) => (
        <SideSheet key={side} side={side} />
      ))}
    </div>
  );
}
