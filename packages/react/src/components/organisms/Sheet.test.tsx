import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
