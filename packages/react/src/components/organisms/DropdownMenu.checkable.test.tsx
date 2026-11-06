import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DropdownMenuCheckboxItemProps } from './DropdownMenu.js';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './DropdownMenu.js';

/* #273. The two checkable items share one indicator slot and one key path:
 * Enter chooses and closes (unless closeOnSelect is false), Space chooses and
 * keeps the menu open — the WAI-ARIA menu pattern's split.
 *
 * Both are controlled only: the menu unmounts its items on close, so state an
 * item kept for itself would reset on every reopen. */

function Menu({ children, defaultOpen }: { children: ReactNode; defaultOpen?: boolean }) {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger>View</DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'View' }));
}

const checkbox = (name: string) => screen.getByRole('menuitemcheckbox', { name });
const radio = (name: string) => screen.getByRole('menuitemradio', { name });
const trigger = () => screen.getByRole('button', { name: 'View' });

/** A menu with one checkbox item whose state lives above the menu, as a
 * consumer's would: anything inside the content unmounts on close. */
function Panel({ onCheckedChange, ...props }: Partial<DropdownMenuCheckboxItemProps>) {
  const [checked, setChecked] = useState(false);
  return (
    <Menu>
      <DropdownMenuCheckboxItem
        checked={checked}
        onCheckedChange={(next) => {
          onCheckedChange?.(next);
          setChecked(next);
        }}
        {...props}
      >
        Panel
      </DropdownMenuCheckboxItem>
    </Menu>
  );
}

describe('DropdownMenuCheckboxItem', () => {
  it('is a menuitemcheckbox that reports checked in aria-checked', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <DropdownMenuCheckboxItem checked>Status bar</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={false}>Minimap</DropdownMenuCheckboxItem>
      </Menu>,
    );
    await open(user);

    expect(checkbox('Status bar')).toHaveAttribute('aria-checked', 'true');
    expect(checkbox('Minimap')).toHaveAttribute('aria-checked', 'false');
  });

  it('asks for the new state but shows the checked prop until the owner changes it', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Menu>
        <DropdownMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
          Panel
        </DropdownMenuCheckboxItem>
      </Menu>,
    );

    await open(user);
    await user.keyboard(' ');

    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(checkbox('Panel')).toHaveAttribute('aria-checked', 'false');
  });

  // The reason the item is controlled: the owner's state outlives the
  // unmount on close, so the item comes back as it was left.
  it('toggles on a click, closes, and keeps its state across a reopen', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Panel onCheckedChange={onCheckedChange} />);

    await open(user);
    await user.click(checkbox('Panel'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await open(user);
    expect(checkbox('Panel')).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox('Panel'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it('toggles on Space and keeps the menu open', async () => {
    const user = userEvent.setup();
    render(<Panel />);
    await open(user);

    await user.keyboard(' ');
    expect(checkbox('Panel')).toHaveAttribute('aria-checked', 'true');
    await user.keyboard(' ');
    expect(checkbox('Panel')).toHaveAttribute('aria-checked', 'false');
    expect(checkbox('Panel')).toHaveFocus();
  });

  it('toggles on Enter, closes, and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Panel onCheckedChange={onCheckedChange} />);
    await open(user);

    await user.keyboard('{Enter}');

    expect(onCheckedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it('stays open on Enter and on a click when closeOnSelect is false', async () => {
    const user = userEvent.setup();
    render(<Panel closeOnSelect={false} />);
    await open(user);

    await user.keyboard('{Enter}');
    expect(checkbox('Panel')).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox('Panel'));
    expect(checkbox('Panel')).toHaveAttribute('aria-checked', 'false');
  });

  it('cannot be toggled when disabled or aria-disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Menu defaultOpen>
        <DropdownMenuCheckboxItem checked={false} disabled onCheckedChange={onCheckedChange}>
          Panel
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={false}
          aria-disabled="true"
          onCheckedChange={onCheckedChange}
        >
          Minimap
        </DropdownMenuCheckboxItem>
      </Menu>,
    );

    await user.click(checkbox('Panel'));
    await user.click(checkbox('Minimap'));
    checkbox('Minimap').focus();
    await user.keyboard(' {Enter}');

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  // The slot is always there, so a label does not shift sideways when its
  // mark appears.
  it('renders the indicator slot whether or not it is checked', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <DropdownMenuCheckboxItem checked>Status bar</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={false}>Minimap</DropdownMenuCheckboxItem>
      </Menu>,
    );
    await open(user);

    const on = checkbox('Status bar').querySelector('.ds-dropdown__indicator');
    const off = checkbox('Minimap').querySelector('.ds-dropdown__indicator');
    expect(on).toHaveAttribute('aria-hidden', 'true');
    expect(off).toHaveAttribute('aria-hidden', 'true');
    expect(on?.querySelector('svg')).not.toBeNull();
    expect(off?.childElementCount).toBe(0);
  });
});

describe('DropdownMenuRadioItem', () => {
  function Items() {
    return (
      <>
        <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="size" disabled>
          Size
        </DropdownMenuRadioItem>
      </>
    );
  }

  /** A group whose value lives in its parent, as a consumer's would. */
  function Sort({
    initial = 'name',
    onValueChange,
  }: {
    initial?: string;
    onValueChange?: (value: string) => void;
  }) {
    const [value, setValue] = useState(initial);
    return (
      <Menu>
        <DropdownMenuRadioGroup
          aria-label="Sort"
          value={value}
          onValueChange={(next) => {
            onValueChange?.(next);
            setValue(next);
          }}
        >
          <Items />
        </DropdownMenuRadioGroup>
      </Menu>
    );
  }

  it('is a menuitemradio inside a group, with the value item checked', async () => {
    const user = userEvent.setup();
    render(<Sort initial="date" />);
    await open(user);

    expect(screen.getByRole('group', { name: 'Sort' })).toBeInTheDocument();
    expect(radio('Name')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Size')).toHaveAttribute('aria-checked', 'false');
  });

  it('asks for the new value but shows the value prop until the owner changes it', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Menu>
        <DropdownMenuRadioGroup value="name" onValueChange={onValueChange}>
          <Items />
        </DropdownMenuRadioGroup>
      </Menu>,
    );
    await open(user);

    await user.keyboard('{ArrowDown} ');

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('date');
    expect(radio('Name')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'false');
  });

  it('selects on a click, closes, and keeps the value across a reopen', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sort initial="date" onValueChange={onValueChange} />);

    await open(user);
    await user.click(radio('Name'));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('name');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await open(user);
    expect(radio('Name')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'false');
  });

  it('does not report a change when the checked item is chosen again', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sort initial="date" onValueChange={onValueChange} />);

    await open(user);
    await user.click(radio('Date'));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('selects on Space and keeps the menu open, selects on Enter and closes', async () => {
    const user = userEvent.setup();
    render(<Sort initial="name" />);
    await open(user);

    await user.keyboard('{ArrowDown} ');
    expect(radio('Date')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Date')).toHaveFocus();

    await user.keyboard('{ArrowUp}{Enter}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    await open(user);
    expect(radio('Name')).toHaveAttribute('aria-checked', 'true');
  });

  it('cannot be selected when disabled', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Sort initial="name" onValueChange={onValueChange} />);
    await open(user);

    await user.click(radio('Size'));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(radio('Size')).toHaveAttribute('aria-checked', 'false');
  });

  it('renders the indicator slot whether or not it is checked', async () => {
    const user = userEvent.setup();
    render(<Sort initial="name" />);
    await open(user);

    const on = radio('Name').querySelector('.ds-dropdown__indicator');
    const off = radio('Date').querySelector('.ds-dropdown__indicator');
    expect(on?.childElementCount).toBe(1);
    expect(off).toHaveAttribute('aria-hidden', 'true');
    expect(off?.childElementCount).toBe(0);
  });

  it('throws outside a DropdownMenuRadioGroup', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <Menu defaultOpen>
          <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
        </Menu>,
      ),
    ).toThrow(/DropdownMenuRadioGroup/);
    error.mockRestore();
  });
});
