import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from './DatePicker.js';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './Dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu.js';
import { Popover, PopoverContent, PopoverTrigger } from './Popover.js';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './Sheet.js';

// `defaultOpen` is the uncontrolled counterpart of `open`: it seeds the initial
// state and then stops mattering, so the component still opens and closes on
// its own afterwards. Every component that declares the prop is tested here, so
// the convention is one thing rather than five separate spellings of it.
//
// DatePicker owns its open state outright — it has no controlled `open` prop to
// defer to — so it takes the seeding half of the convention and not the
// deferral half.
describe('defaultOpen', () => {
  describe('Popover', () => {
    it('starts open', () => {
      render(
        <Popover defaultOpen>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>panel body</PopoverContent>
        </Popover>,
      );

      expect(screen.getByText('panel body')).toBeInTheDocument();
    });

    it('still closes after starting open', async () => {
      const user = userEvent.setup();

      render(
        <Popover defaultOpen>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>panel body</PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    });

    it('defers to the controlled open prop', () => {
      render(
        <Popover defaultOpen open={false}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>panel body</PopoverContent>
        </Popover>,
      );

      expect(screen.queryByText('panel body')).not.toBeInTheDocument();
    });
  });

  describe('DatePicker', () => {
    it('starts open', () => {
      render(
        <DatePicker
          label="Start date"
          value={new Date(2026, 0, 15)}
          onValueChange={vi.fn()}
          defaultOpen
        />,
      );

      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('still closes after starting open', async () => {
      const user = userEvent.setup();

      render(
        <DatePicker
          label="Start date"
          value={new Date(2026, 0, 15)}
          onValueChange={vi.fn()}
          defaultOpen
        />,
      );

      await user.click(screen.getByLabelText('Start date'));

      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('DropdownMenu', () => {
    it('starts open', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
    });

    it('defers to the controlled open prop', () => {
      render(
        <DropdownMenu defaultOpen open={false}>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );

      expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument();
    });
  });

  describe('Dialog', () => {
    it('starts open', () => {
      render(
        <Dialog defaultOpen>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('defers to the controlled open prop', () => {
      render(
        <Dialog defaultOpen open={false}>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Sheet', () => {
    it('starts open', () => {
      render(
        <Sheet defaultOpen>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('defers to the controlled open prop', () => {
      render(
        <Sheet defaultOpen open={false}>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
