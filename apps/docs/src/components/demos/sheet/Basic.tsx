'use client';

import { useState } from 'react';
import { Button } from '@elirobinson/react/components/atoms/Button';
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

export default function Basic() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="ds-button ds-button--primary">Filter guides</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter coaching guides</SheetTitle>
          <SheetDescription>Narrow the list by sport, age group, or session type.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose />
          <Button variant="accent" onClick={() => setOpen(false)}>
            Apply filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
