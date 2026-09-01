import type { FormEvent } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { stubViewportLayout } from '../../test/viewport.js';
import type { DropdownMenuContentProps } from './DropdownMenu.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu.js';

describe('DropdownMenu', () => {
  it('opens when the trigger is clicked', async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
  });

  // The SSR mount gate returns null on the very first render. Anything driven
  // by the `open` prop rather than a click has to survive that and still show
  // up once mounted.
  it('shows content that starts open via the open prop', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
  });

  it('closes after an item is chosen', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onSelect}>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  // Issue #179. `onOpenChange(false)` from the item's own onClick is a discrete
  // update React flushes synchronously inside the click dispatch, so the portal
  // unmounts while the browser is still processing the activation that submitted
  // the form — the submit event fires against a detached tree and React has no
  // live fiber left to run the form's `action`/`onSubmit` against. A submit item
  // therefore does not close by default.
  it('lets a type="submit" item submit the form it is in', async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      connectedAtSubmit = event.currentTarget.isConnected;
    });
    let connectedAtSubmit: boolean | null = null;

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Account</DropdownMenuTrigger>
        <DropdownMenuContent>
          <form action={action} onSubmit={onSubmit}>
            <DropdownMenuItem type="submit">Sign out</DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Account' }));
    const item = screen.getByRole('menuitem', { name: 'Sign out' });
    await user.click(item);

    // The form's own handlers, not the item's: `onSubmit` fired even before the
    // fix (against a detached tree), but the `action` React was meant to run in
    // its place never did.
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(connectedAtSubmit).toBe(true);
    expect(action).toHaveBeenCalledOnce();
    expect(item.isConnected).toBe(true);
  });

  it('keeps an ordinary item open when closeOnSelect is false', async () => {
    const user = userEvent.setup();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem closeOnSelect={false}>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes a submit item when closeOnSelect is explicitly true', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Account</DropdownMenuTrigger>
        <DropdownMenuContent>
          <form onSubmit={onSubmit}>
            <DropdownMenuItem type="submit" closeOnSelect>
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

/* #180. An account menu whose avatar trigger sits at the far right of a header
 * opened 95px wide against a 180px stylesheet minimum, because the panel is
 * `position: fixed` with no width: its shrink-to-fit is capped by
 * `viewport.width - left`, and the inline `min-width` the positioner wrote was
 * an override rather than a floor. */
describe('DropdownMenu anchoring', () => {
  // jsdom measures every element as 0x0, so without a plausible geometry these
  // could not tell "positioned at the origin" apart from "not positioned".
  stubViewportLayout();

  /** Give one element its own rect and re-run the positioner over it. */
  async function retriggerWithRect(element: HTMLElement, rect: Partial<DOMRect>) {
    Object.defineProperty(element, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, ...rect }),
    });
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
  }

  function renderMenu(props: DropdownMenuContentProps = {}) {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Account</DropdownMenuTrigger>
        <DropdownMenuContent {...props}>
          <DropdownMenuItem>Settings</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    return {
      trigger: screen.getByRole('button', { name: 'Account' }),
      menu: screen.getByRole('menu'),
    };
  }

  it('lines the panel up with the trigger start by default', () => {
    const { menu } = renderMenu();

    expect(menu.style.position).toBe('fixed');
    expect(menu.style.left).toBe('0px');
    expect(menu.style.right).toBe('auto');
  });

  // The reported case. `align: 'start'` cannot help a trigger at the right
  // edge -- what it needs is the panel's RIGHT edge pinned to the trigger's.
  it('pins the panel right edge to the trigger when asked to align to the end', async () => {
    const { trigger, menu } = renderMenu({ align: 'end' });
    expect(window.innerWidth).toBe(1024);

    await retriggerWithRect(trigger, { width: 40, height: 40, left: 964, right: 1004, bottom: 40 });

    expect(menu.style.right).toBe('20px');
    // Left has to be released, or the two edges fight and the panel is
    // stretched across the gap between them.
    expect(menu.style.left).toBe('auto');
  });

  // The options are read by a hook called above the panel in the tree, so
  // "does the prop reach it" is a separate question from "does the hook
  // implement it" -- as shipped, DropdownMenuContent forwarded neither.
  it('forwards the side option through to the positioner', () => {
    const { menu } = renderMenu({ side: 'top' });

    /* `top: auto` is what proves the option reached the positioner: the
       default side pins a top and releases the bottom. The offset itself is
       the shift's — measured from the trigger's top edge the menu would sit
       772px up from the bottom of a 768px viewport, which is off the top of
       it, so it slides back to the last offset a 500px panel fits at. */
    expect(menu.style.top).toBe('auto');
    expect(menu.style.bottom).toBe('268px');
  });

  // The inline declaration outranks the stylesheet, so writing the trigger's
  // width there deletes `.ds-dropdown__content { min-width: 180px }` outright
  // for every icon or avatar trigger. It is meant as a floor.
  it('keeps the inline min-width a floor, not an override of the stylesheet', async () => {
    const { trigger, menu } = renderMenu();

    await retriggerWithRect(trigger, { width: 40, height: 40, left: 964, right: 1004, bottom: 40 });

    expect(menu.style.minWidth).toContain('var(--anchored-min-width');
    expect(menu.style.minWidth).not.toBe('40px');
  });

  it('still widens the panel to a trigger wider than the stylesheet minimum', () => {
    const { menu } = renderMenu();

    // The stubbed trigger is 500px across.
    expect(menu.style.minWidth).toContain('500px');
  });
});
