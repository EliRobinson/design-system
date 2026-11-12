import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { stubViewportLayout } from '../../../test/viewport.js';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '../Dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../DropdownMenu.js';
import { Popover, PopoverContent, PopoverTrigger } from '../Popover.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip.js';

/* #305: every layer listened for Escape on `document` by itself, so one
 * keypress closed all of them. Only the topmost one may close.
 *
 * jsdom's <dialog> never closes on Escape (test/setup.ts only polyfills
 * `showModal`), so the dialog's side is checked through the event: a browser
 * closes a modal <dialog> on Escape only when the keydown is not cancelled.
 * `fireEvent` returns false when it was. */
function pressEscape() {
  return fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
}

describe('Escape closes only the topmost layer', () => {
  stubViewportLayout();

  it('closes a tooltip inside a popover inside a dialog one layer at a time', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <Popover>
            <PopoverTrigger>More</PopoverTrigger>
            <PopoverContent>
              <Tooltip>
                <TooltipTrigger tabIndex={0}>Help</TooltipTrigger>
                <TooltipContent>explanatory text</TooltipContent>
              </Tooltip>
            </PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'More' }));
    screen.getByText('Help').focus();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    expect(pressEscape()).toBe(false);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();

    expect(pressEscape()).toBe(false);
    expect(screen.queryByText('Help')).not.toBeInTheDocument();
    // Focus was inside the popover, so it goes back to its trigger rather than
    // falling to <body> with the panel.
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();

    // Only the dialog is left, and the browser's own cancel closes it.
    expect(pressEscape()).toBe(true);
  });

  it('puts a layer that opened in the same commit as its parent above it', () => {
    // Effects run child first, so a popover that starts open inside a dialog
    // that starts open registers before the dialog does.
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <Popover defaultOpen>
            <PopoverTrigger>More</PopoverTrigger>
            <PopoverContent>Panel</PopoverContent>
          </Popover>
        </DialogContent>
      </Dialog>,
    );

    expect(pressEscape()).toBe(false);
    expect(screen.queryByText('Panel')).not.toBeInTheDocument();
    expect(pressEscape()).toBe(true);
  });

  it('leaves a tooltip opened before a dialog alone and lets the dialog close', async () => {
    // An icon button with a tooltip that opens a dialog: the pointer stays on
    // the trigger, so the tooltip is still open under the modal.
    const user = userEvent.setup();
    render(
      <Dialog>
        <Tooltip>
          <TooltipTrigger>
            <DialogTrigger>Open</DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Open settings</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.hover(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();

    expect(pressEscape()).toBe(true);
    expect(screen.getByRole('tooltip', { hidden: true })).toBeInTheDocument();
  });

  it('closes a tooltip inside a menu without moving focus out of the menu', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <Tooltip>
            <TooltipTrigger>
              <DropdownMenuItem>Rename</DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent>Give it a new name</TooltipContent>
          </Tooltip>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const item = screen.getByRole('menuitem', { name: 'Rename' });
    expect(item).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(item).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  });

  it('leaves an Escape that something inside the layer already handled', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>More</PopoverTrigger>
        <PopoverContent>
          {/* A Combobox closing its own listbox cancels the keydown. */}
          <input aria-label="Search" onKeyDown={(event) => event.preventDefault()} />
        </PopoverContent>
      </Popover>,
    );

    screen.getByRole('textbox', { name: 'Search' }).focus();
    pressEscape();
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
  });
});
