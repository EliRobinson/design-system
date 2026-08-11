import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
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

  // DialogTrigger and DialogClose render a <button> but were plain function
  // components typed `HTMLAttributes`, violating the `forward-ref` contract.
  //
  // On React 19 the runtime half of that was invisible: `ref` is an ordinary
  // prop for function components, so it rode the `{...props}` spread down to
  // the <button> and worked by accident. The break was purely at the type
  // level -- neither `ref` nor `disabled` existed on the props type, so the
  // component was unusable from TypeScript for the thing it already did.
  // These assertions therefore guard the runtime contract, and `pnpm
  // typecheck` guards the part that was actually broken: every case below
  // fails to compile against the pre-fix components.
  describe('ref forwarding', () => {
    it('forwards an object ref on DialogTrigger to the button node', () => {
      const ref = createRef<HTMLButtonElement>();

      render(
        <Dialog>
          <DialogTrigger ref={ref}>Open dialog</DialogTrigger>
        </Dialog>,
      );

      expect(ref.current).toBe(screen.getByRole('button', { name: 'Open dialog' }));
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('forwards a callback ref on DialogTrigger to the button node', () => {
      const seen: (HTMLButtonElement | null)[] = [];

      render(
        <Dialog>
          <DialogTrigger
            ref={(node) => {
              seen.push(node);
            }}
          >
            Open dialog
          </DialogTrigger>
        </Dialog>,
      );

      expect(seen[0]).toBe(screen.getByRole('button', { name: 'Open dialog' }));
    });

    it('forwards an object ref on DialogClose to the button node', () => {
      const ref = createRef<HTMLButtonElement>();

      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
            <DialogClose ref={ref}>Close</DialogClose>
          </DialogContent>
        </Dialog>,
      );

      expect(ref.current).toBe(screen.getByRole('button', { name: 'Close' }));
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('forwards a callback ref on DialogClose to the button node', () => {
      const seen: (HTMLButtonElement | null)[] = [];

      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
            <DialogClose
              ref={(node) => {
                seen.push(node);
              }}
            >
              Close
            </DialogClose>
          </DialogContent>
        </Dialog>,
      );

      expect(seen[0]).toBe(screen.getByRole('button', { name: 'Close' }));
    });

    it('lets a forwarded ref focus the trigger', async () => {
      const user = userEvent.setup();
      const ref = createRef<HTMLButtonElement>();

      render(
        <Dialog>
          <DialogTrigger ref={ref}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      await user.click(screen.getByRole('button', { name: 'Open dialog' }));
      ref.current?.focus();

      expect(screen.getByRole('button', { name: 'Open dialog' })).toHaveFocus();
    });
  });

  // The props were typed `HTMLAttributes`, which carries no button attributes,
  // so `disabled` was a type error on a component that is literally a <button>.
  describe('button attributes', () => {
    it('honours disabled on DialogTrigger', async () => {
      const user = userEvent.setup();

      render(
        <Dialog>
          <DialogTrigger disabled>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      const trigger = screen.getByRole('button', { name: 'Open dialog' });
      expect(trigger).toBeDisabled();

      await user.click(trigger);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // `type="button"` is a default, not a pin: it precedes the prop spread, so
    // a close button that also submits an enclosing form stays expressible.
    it('defaults to type="button" but lets a consumer override it', () => {
      render(
        <Dialog defaultOpen>
          <DialogContent>
            <DialogTitle>Contact</DialogTitle>
            <DialogClose>Close</DialogClose>
            <DialogClose type="submit">Save</DialogClose>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('type', 'button');
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
    });
  });
});
