import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { describe, expect, it } from 'vitest';

import { stubViewportLayout } from '../../../test/viewport.js';
import { Dialog, DialogContent, DialogTitle } from '../Dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../DropdownMenu.js';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover.js';

/* #397: an overlay closed on a mousedown that was not inside its own trigger
 * or panel in the DOM. A panel opened from inside another one is portalled to
 * the end of <body>, so a click in the inner panel closed the outer one. A
 * click inside any layer opened within this one is not outside it. */

function NestedPopovers() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger>Outer</PopoverTrigger>
      <PopoverContent>
        <p>Outer panel</p>
        <Popover defaultOpen>
          <PopoverTrigger>Inner</PopoverTrigger>
          <PopoverContent>
            <p>Inner panel</p>
          </PopoverContent>
        </Popover>
      </PopoverContent>
    </Popover>
  );
}

describe('a click inside a nested layer is not outside its parent', () => {
  stubViewportLayout();

  it('keeps the outer popover open on a mousedown inside the inner panel', () => {
    render(<NestedPopovers />);

    fireEvent.mouseDown(screen.getByText('Inner panel'));

    expect(screen.getByText('Outer panel')).toBeInTheDocument();
    expect(screen.getByText('Inner panel')).toBeInTheDocument();
  });

  it('closes only the inner popover on a mousedown inside the outer panel', () => {
    render(<NestedPopovers />);

    fireEvent.mouseDown(screen.getByText('Outer panel'));

    expect(screen.getByText('Outer panel')).toBeInTheDocument();
    expect(screen.queryByText('Inner panel')).not.toBeInTheDocument();
  });

  it('closes both on a mousedown outside every layer', () => {
    render(<NestedPopovers />);

    fireEvent.mouseDown(document.body);

    expect(screen.queryByText('Outer panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Inner panel')).not.toBeInTheDocument();
  });

  it('keeps a popover open on a mousedown inside a menu opened from it', async () => {
    const user = userEvent.setup();
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Filters</PopoverTrigger>
        <PopoverContent>
          <p>Filter panel</p>
          <DropdownMenu>
            <DropdownMenuTrigger>Sort</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Newest</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.mouseDown(screen.getByRole('menuitem', { name: 'Newest' }));

    expect(screen.getByText('Filter panel')).toBeInTheDocument();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('keeps a dialog open on a click inside a popover opened from it', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <Popover defaultOpen>
            <PopoverTrigger>More</PopoverTrigger>
            <PopoverContent>
              <p>Popover panel</p>
            </PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );

    const panel = screen.getByText('Popover panel');
    fireEvent.mouseDown(panel);
    fireEvent.click(panel);

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Popover panel')).toBeInTheDocument();
  });

  it('keeps a popover open on a mousedown inside a dialog opened from it, even portalled', () => {
    // Sheet is the same modal surface, so this covers it too.
    render(
      <Popover defaultOpen>
        <PopoverTrigger>More</PopoverTrigger>
        <PopoverContent>
          <p>Popover panel</p>
          <Dialog defaultOpen>
            {createPortal(
              <DialogContent>
                <DialogTitle>Confirm</DialogTitle>
              </DialogContent>,
              document.body,
            )}
          </Dialog>
        </PopoverContent>
      </Popover>,
    );

    fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Confirm' }));

    expect(screen.getByText('Popover panel')).toBeInTheDocument();
  });
});
