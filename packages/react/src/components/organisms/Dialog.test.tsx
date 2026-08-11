import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './Dialog';

describe('Dialog', () => {
  it('opens when the trigger is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Contact</DialogTitle>
          <DialogDescription>Get in touch within 24 hours.</DialogDescription>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
  });

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Dialog onOpenChange={onOpenChange}>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Contact</DialogTitle>
          <DialogClose>Close</DialogClose>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  // The title and description ids used to be the constants 'ds-dialog-title'
  // and 'ds-dialog-description'. Two dialogs on one page therefore emitted
  // duplicate ids, and every aria-labelledby resolved to whichever rendered
  // first -- so the second dialog announced the first one's title, with no
  // visible symptom.
  it('gives each mounted Dialog its own title and description ids', () => {
    render(
      <>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
            <DialogDescription>Get in touch within 24 hours.</DialogDescription>
          </DialogContent>
        </Dialog>
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogContent>
        </Dialog>
      </>,
    );

    const [first, second] = screen.getAllByRole('dialog');

    expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'));
    expect(first.getAttribute('aria-describedby')).not.toBe(
      second.getAttribute('aria-describedby'),
    );

    expect(first).toHaveAccessibleName('Contact');
    expect(second).toHaveAccessibleName('Delete account');
    expect(second).toHaveAccessibleDescription('This cannot be undone.');
  });
});
