import { createRef } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from './CommandPalette';

const commands = [
  { id: 'new', label: 'New file', onSelect: vi.fn() },
  { id: 'open', label: 'Open file', onSelect: vi.fn() },
];

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    render(<CommandPalette isOpen={false} onOpenChange={vi.fn()} commands={commands} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders as a genuine modal dialog when open, and filters commands by search text', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen onOpenChange={vi.fn()} commands={commands} />);

    // Positive fact: this is a real modal, not a bare <div> -- the exact gap
    // the task brief's version silently had (it rendered <Dialog>'s inline
    // children directly, with no <DialogContent>, so `role="dialog"` never
    // existed at all and this assertion would fail against that version).
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox'), 'new');

    expect(screen.getByText('New file')).toBeInTheDocument();
    expect(screen.queryByText('Open file')).not.toBeInTheDocument();
  });

  it('calls onSelect and closes when a command is chosen', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    const customCommands = [{ id: 'new', label: 'New file', onSelect }];

    render(<CommandPalette isOpen onOpenChange={onOpenChange} commands={customCommands} />);
    await user.click(screen.getByText('New file'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has an accessible name wired through aria-labelledby to a real, rendered title', () => {
    render(<CommandPalette isOpen onOpenChange={vi.fn()} commands={commands} />);

    const dialog = screen.getByRole('dialog');
    const labelledbyId = dialog.getAttribute('aria-labelledby');

    // DialogContent hardcodes aria-labelledby="ds-dialog-title" -- if this
    // component never renders a <DialogTitle>, that id dangles and the
    // dialog has no accessible name at all.
    expect(labelledbyId).toBeTruthy();
    expect(document.getElementById(labelledbyId as string)).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName();
  });

  it('moves the active command with ArrowDown/ArrowUp and keeps aria-activedescendant pointed at a real, rendered element', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen onOpenChange={vi.fn()} commands={commands} />);

    const input = screen.getByRole('searchbox');

    let activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId as string)).toHaveTextContent('New file');

    await user.keyboard('{ArrowDown}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    // The id aria-activedescendant points at must actually resolve in the
    // DOM -- a dangling id is a silent, un-announced bug for assistive tech.
    expect(document.getElementById(activeId as string)).toBeInTheDocument();
    expect(document.getElementById(activeId as string)).toHaveTextContent('Open file');

    // Clamped at the end, not wrapped.
    await user.keyboard('{ArrowDown}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('Open file');

    await user.keyboard('{ArrowUp}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('New file');

    // DOM focus never leaves the input -- that's the entire point of
    // aria-activedescendant, and it's the same focus model Combobox (Task
    // 18) uses for consistency across the library.
    expect(input).toHaveFocus();
  });

  it('runs the active command (not just the first one) on Enter and closes', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSelectNew = vi.fn();
    const onSelectOpen = vi.fn();
    const customCommands = [
      { id: 'new', label: 'New file', onSelect: onSelectNew },
      { id: 'open', label: 'Open file', onSelect: onSelectOpen },
    ];

    render(<CommandPalette isOpen onOpenChange={onOpenChange} commands={customCommands} />);

    await user.keyboard('{ArrowDown}'); // move from "New file" to "Open file"
    await user.keyboard('{Enter}');

    expect(onSelectOpen).toHaveBeenCalledTimes(1);
    expect(onSelectNew).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape without running any command', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<CommandPalette isOpen onOpenChange={onOpenChange} commands={commands} />);
    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(commands[0].onSelect).not.toHaveBeenCalled();
    expect(commands[1].onSelect).not.toHaveBeenCalled();
  });

  it('renders shortcut hints as Kbd elements', () => {
    render(
      <CommandPalette
        isOpen
        onOpenChange={vi.fn()}
        commands={[{ id: 'save', label: 'Save', shortcut: ['⌘', 'S'], onSelect: vi.fn() }]}
      />,
    );

    const kbdElements = screen.getAllByText(/⌘|S/);
    expect(kbdElements.some((el) => el.tagName.toLowerCase() === 'kbd')).toBe(true);
  });

  it("forwards the ref to the underlying input element (SearchField's forwarded-ref contract)", () => {
    const ref = createRef<HTMLInputElement>();
    render(<CommandPalette ref={ref} isOpen onOpenChange={vi.fn()} commands={commands} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toHaveFocus();
  });

  it('resets the query and active index each time it re-opens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CommandPalette isOpen onOpenChange={vi.fn()} commands={commands} />,
    );

    await user.type(screen.getByRole('searchbox'), 'new');
    expect(screen.queryByText('Open file')).not.toBeInTheDocument();

    rerender(<CommandPalette isOpen={false} onOpenChange={vi.fn()} commands={commands} />);
    rerender(<CommandPalette isOpen onOpenChange={vi.fn()} commands={commands} />);

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByText('Open file')).toBeInTheDocument();
  });
});
