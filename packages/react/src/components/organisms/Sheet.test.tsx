import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from './Sheet';

describe('Sheet', () => {
  it('opens from its trigger and closes from its close button', async () => {
    const user = userEvent.setup();

    render(
      <Sheet>
        <SheetTrigger>Open filters</SheetTrigger>
        <SheetContent>
          <SheetTitle>Filters</SheetTitle>
          <SheetClose>Done</SheetClose>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open filters' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('takes its edge from SheetContent, which is the only place side lives', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent side="left">
          <SheetTitle>Filters</SheetTitle>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole('dialog')).toHaveClass('ds-sheet--left');
  });

  // Same defect Dialog had: the ids were the constants 'ds-sheet-title' and
  // 'ds-sheet-description', so two sheets on one page collided and the second
  // one's aria-labelledby resolved to the first one's title.
  it('gives each mounted Sheet its own title and description ids', () => {
    render(
      <>
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow the result set.</SheetDescription>
          </SheetContent>
        </Sheet>
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>Preferences</SheetTitle>
            <SheetDescription>Saved to this browser.</SheetDescription>
          </SheetContent>
        </Sheet>
      </>,
    );

    const [first, second] = screen.getAllByRole('dialog');

    expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'));
    expect(first).toHaveAccessibleName('Filters');
    expect(second).toHaveAccessibleName('Preferences');
    expect(second).toHaveAccessibleDescription('Saved to this browser.');
  });

  // Same `forward-ref` contract violation Dialog's trigger and close button
  // had, via the same shared modal parts -- and the same type-level-only
  // symptom on React 19. See the note in Dialog.test.tsx.
  describe('ref forwarding', () => {
    it('forwards an object ref on SheetTrigger to the button node', () => {
      const ref = createRef<HTMLButtonElement>();

      render(
        <Sheet>
          <SheetTrigger ref={ref}>Open filters</SheetTrigger>
        </Sheet>,
      );

      expect(ref.current).toBe(screen.getByRole('button', { name: 'Open filters' }));
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('forwards a callback ref on SheetTrigger to the button node', () => {
      const seen: (HTMLButtonElement | null)[] = [];

      render(
        <Sheet>
          <SheetTrigger
            ref={(node) => {
              seen.push(node);
            }}
          >
            Open filters
          </SheetTrigger>
        </Sheet>,
      );

      expect(seen[0]).toBe(screen.getByRole('button', { name: 'Open filters' }));
    });

    it('forwards an object ref on SheetClose to the button node', () => {
      const ref = createRef<HTMLButtonElement>();

      render(
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
            <SheetClose ref={ref}>Done</SheetClose>
          </SheetContent>
        </Sheet>,
      );

      expect(ref.current).toBe(screen.getByRole('button', { name: 'Done' }));
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('forwards a callback ref on SheetClose to the button node', () => {
      const seen: (HTMLButtonElement | null)[] = [];

      render(
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
            <SheetClose
              ref={(node) => {
                seen.push(node);
              }}
            >
              Done
            </SheetClose>
          </SheetContent>
        </Sheet>,
      );

      expect(seen[0]).toBe(screen.getByRole('button', { name: 'Done' }));
    });

    it('lets a forwarded ref focus the close button', () => {
      const ref = createRef<HTMLButtonElement>();

      render(
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
            <SheetClose ref={ref}>Done</SheetClose>
          </SheetContent>
        </Sheet>,
      );

      ref.current?.focus();

      expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
    });
  });

  describe('button attributes', () => {
    it('honours disabled on SheetTrigger', async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger disabled>Open filters</SheetTrigger>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      const trigger = screen.getByRole('button', { name: 'Open filters' });
      expect(trigger).toBeDisabled();

      await user.click(trigger);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('defaults to type="button" but lets a consumer override it', () => {
      render(
        <Sheet defaultOpen>
          <SheetContent>
            <SheetTitle>Filters</SheetTitle>
            <SheetClose>Done</SheetClose>
            <SheetClose type="submit">Apply</SheetClose>
          </SheetContent>
        </Sheet>,
      );

      expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute('type', 'button');
      expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('type', 'submit');
    });
  });
});
