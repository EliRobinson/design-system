import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@design-system/react/components/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@design-system/react/components/Dialog';

const meta = {
  title: 'Components/Dialog',
  component: Dialog,
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function DialogDemo() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <Button variant="accent" onClick={() => setOpen(false)}>
            Send message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const Default: Story = {
  args: { children: null },
  render: () => <DialogDemo />,
};
