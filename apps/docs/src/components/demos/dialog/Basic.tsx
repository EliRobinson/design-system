'use client';

import { Button } from '@elirobinson/react/components/atoms/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@elirobinson/react/components/organisms/Dialog';

export default function Basic() {
  return (
    <Dialog>
      <DialogTrigger className="ds-button ds-button--primary">Get in touch</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Eli</DialogTitle>
          <DialogDescription>
            Practical AI consulting and tech support. No contracts required.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose />
          <Button variant="accent">Send message</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
