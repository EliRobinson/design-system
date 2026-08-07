'use client';

import { useState } from 'react';

import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@elirobinson/react/components/organisms/Dialog';

export default function Controlled() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Delete guide
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;U8 Soccer Season Plan&quot;?</DialogTitle>
            <DialogDescription>
              This removes the guide from your library. Anyone who already downloaded it keeps their
              copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>Cancel</DialogClose>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
