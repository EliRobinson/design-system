import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './DropdownMenu.js';

/* #273. The WAI-ARIA menu button pattern: the content is portalled to the end
 * of <body>, so nothing reaches the items unless focus is moved there on open
 * and moved back to the trigger on the way out. */

/** A menu with every item role, a disabled item of each kind of disabled, and
 * a control after the trigger so Tab has somewhere to go. */
function renderMenu({ onDuplicate = vi.fn(), onPin = vi.fn() } = {}) {
  render(
    <>
      <button type="button">Before</button>
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem aria-disabled="true">Move</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={onPin}>
            Pinned
          </DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="list">
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="grid" disabled>
              Grid
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuItem>Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button">After</button>
    </>,
  );

  return {
    trigger: screen.getByRole('button', { name: 'Actions' }),
    // Any of the three item roles, by label.
    item: (name: string) => screen.getByText(name, { selector: 'button' }),
  };
}

async function openWithKeyboard(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  trigger.focus();
  await user.keyboard('{Enter}');
}

describe('DropdownMenu keyboard path', () => {
  it('moves focus to the first item that can be chosen when it opens', async () => {
    const user = userEvent.setup();
    const { trigger, item } = renderMenu();

    await openWithKeyboard(user, trigger);

    expect(screen.getByRole('menu')).toBeInTheDocument();
    // "Rename" is disabled, so the first item that can be chosen is the second.
    expect(item('Duplicate')).toHaveFocus();
  });

  it('moves focus into the menu when opened with a click too', async () => {
    const user = userEvent.setup();
    const { trigger, item } = renderMenu();

    await user.click(trigger);

    expect(item('Duplicate')).toHaveFocus();
  });

  it('walks every item role with the arrow keys, skipping disabled items and wrapping', async () => {
    const user = userEvent.setup();
    const { trigger, item } = renderMenu();
    await openWithKeyboard(user, trigger);

    await user.keyboard('{ArrowDown}');
    // "Move" is aria-disabled and skipped like a disabled one.
    expect(item('Pinned')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('List')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    // "Grid" is a disabled radio item.
    expect(item('Archive')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Duplicate')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('Archive')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('List')).toHaveFocus();
  });

  it('jumps to the first and last items that can be chosen with Home and End', async () => {
    const user = userEvent.setup();
    const { trigger, item } = renderMenu();
    await openWithKeyboard(user, trigger);

    await user.keyboard('{End}');
    expect(item('Archive')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(item('Duplicate')).toHaveFocus();
  });

  // The old handler kept its own index, so focus placed on an item any other
  // way (a pointer, a consumer's focus()) made the next arrow jump from
  // wherever the index last was.
  it('moves from the focused item, not from a remembered position', async () => {
    const user = userEvent.setup();
    const { trigger, item } = renderMenu();
    await openWithKeyboard(user, trigger);

    item('List').focus();
    await user.keyboard('{ArrowDown}');

    expect(item('Archive')).toHaveFocus();
  });

  it('opens on ArrowDown at the first item and on ArrowUp at the last', async () => {
    const user = userEvent.setup();
    const { trigger, item } = renderMenu();

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(item('Duplicate')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.keyboard('{ArrowUp}');
    expect(item('Archive')).toHaveFocus();
  });

  it('returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();
    await openWithKeyboard(user, trigger);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('returns focus to the trigger when an item is chosen', async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const { trigger } = renderMenu({ onDuplicate });
    await openWithKeyboard(user, trigger);

    await user.keyboard('{Enter}');

    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  // Tab hands focus back to the trigger and is not cancelled, so the
  // browser's own Tab carries on from the trigger — to the control after it,
  // or before it with Shift — not from the portal at the end of <body>.
  // fireEvent rather than user.tab(): user-event computes the Tab destination
  // from the key's original target, where a browser uses whatever has focus
  // when the default action runs.
  it.each([false, true])(
    'closes on Tab (shift: %s) and hands focus to the trigger',
    async (shiftKey) => {
      const user = userEvent.setup();
      const { trigger, item } = renderMenu();
      await openWithKeyboard(user, trigger);

      const notCancelled = fireEvent.keyDown(item('Duplicate'), { key: 'Tab', shiftKey });

      expect(notCancelled).toBe(true);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    },
  );

  it('leaves focus where the user clicked when they click outside', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();
    await openWithKeyboard(user, trigger);

    const after = screen.getByRole('button', { name: 'After' });
    await user.click(after);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(after).toHaveFocus();
  });

  // Enter on the trigger opens the menu and moves focus to the first item, so
  // the key's auto-repeat lands on that item and would choose it. A cancelled
  // Enter keydown is what stops a button's click in a browser. user-event has
  // no way to send `repeat: true`, so the repeat is sent by hand.
  it.each(['Enter', ' '])('cancels a held %j repeating onto the first item', async (key) => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    const { trigger, item } = renderMenu({ onDuplicate });
    await openWithKeyboard(user, trigger);

    const notCancelled = fireEvent.keyDown(item('Duplicate'), { key, repeat: true });

    expect(notCancelled).toBe(false);
    expect(onDuplicate).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('does not toggle a checkbox item on a held Space or Enter', async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    const { trigger, item } = renderMenu({ onPin });
    await openWithKeyboard(user, trigger);

    fireEvent.keyDown(item('Pinned'), { key: ' ', repeat: true });
    fireEvent.keyDown(item('Pinned'), { key: 'Enter', repeat: true });

    expect(onPin).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('still lets a first, unrepeated Enter on an item choose it', async () => {
    const user = userEvent.setup();
    const { trigger, item } = renderMenu();
    await openWithKeyboard(user, trigger);

    expect(fireEvent.keyDown(item('Duplicate'), { key: 'Enter' })).toBe(true);
  });

  it('does not activate an aria-disabled item', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();

    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem aria-disabled="true" onClick={onMove}>
            Move
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole('menuitem', { name: 'Move' }));

    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('does not steal focus for a menu that starts open', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(document.body).toHaveFocus();
  });
});
