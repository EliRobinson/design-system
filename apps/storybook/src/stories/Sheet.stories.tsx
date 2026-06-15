import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@design-system/react/components/Button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@design-system/react/components/Sheet';

const meta = {
  title: 'Components/Sheet',
  component: Sheet,
  tags: ['autodocs'],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function SheetDemo() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="ds-button ds-button--primary">Open filters</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Coaching guides</SheetTitle>
          <SheetDescription>Filter by sport, age group, or session type.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose />
          <Button variant="accent" onClick={() => setOpen(false)}>
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export const Right: Story = {
  args: { children: null },
  render: () => <SheetDemo />,
};
