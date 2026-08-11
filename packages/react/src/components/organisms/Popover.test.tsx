import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { stubViewportLayout } from '../../test/viewport';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

describe('Popover', () => {
  it('opens when the trigger is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>panel body</PopoverContent>
      </Popover>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  // The SSR mount gate returns null on the very first render. Anything driven
  // by the `open` prop rather than a click has to survive that and still show
  // up once mounted.
  it('shows content that starts open via the open prop', () => {
    render(
      <Popover open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>panel body</PopoverContent>
      </Popover>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('marks the trigger as expanded while open', async () => {
    const user = userEvent.setup();

    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>panel body</PopoverContent>
      </Popover>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Popover anchoring', () => {
  stubViewportLayout();

  // The panel's position is written by a layout effect keyed off the open
  // state, but a popover that starts open has no content node on its first
  // render -- the SSR mount gate holds the portal back. Nothing would re-run
  // the effect on the commit the panel actually appears in, so it used to land
  // unpositioned until the next scroll or resize.
  it('positions a panel that starts open before the portal has mounted', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>panel body</PopoverContent>
      </Popover>,
    );

    const panel = screen.getByRole('dialog');
    expect(panel.style.position).toBe('fixed');
    // Bottom of the stubbed 500x500 trigger rect, plus the shared 4px gap.
    expect(panel.style.top).toBe('504px');
  });
});
