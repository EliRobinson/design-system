import { StrictMode, createRef, useState } from 'react';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { stubConsumerReset } from '../../test/consumerReset.js';
import { CommandPalette } from './CommandPalette.js';

const commands = [
  { id: 'new', label: 'New file', onSelect: vi.fn() },
  { id: 'open', label: 'Open file', onSelect: vi.fn() },
];

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    render(<CommandPalette open={false} onOpenChange={vi.fn()} commands={commands} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders as a genuine modal dialog when open, and filters commands by search text', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);

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

    render(<CommandPalette open onOpenChange={onOpenChange} commands={customCommands} />);
    await user.click(screen.getByText('New file'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has an accessible name wired through aria-labelledby to a real, rendered title', () => {
    render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);

    const dialog = screen.getByRole('dialog');
    const labelledbyId = dialog.getAttribute('aria-labelledby');

    // DialogContent's aria-labelledby points at the id Dialog minted for its
    // title -- if this component never renders a <DialogTitle>, that id
    // dangles and the dialog has no accessible name at all.
    expect(labelledbyId).toBeTruthy();
    expect(document.getElementById(labelledbyId as string)).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName();
  });

  it('moves the active command with ArrowDown/ArrowUp and keeps aria-activedescendant pointed at a real, rendered element', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);

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

    render(<CommandPalette open onOpenChange={onOpenChange} commands={customCommands} />);

    await user.keyboard('{ArrowDown}'); // move from "New file" to "Open file"
    await user.keyboard('{Enter}');

    expect(onSelectOpen).toHaveBeenCalledTimes(1);
    expect(onSelectNew).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape without running any command', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<CommandPalette open onOpenChange={onOpenChange} commands={commands} />);
    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(commands[0].onSelect).not.toHaveBeenCalled();
    expect(commands[1].onSelect).not.toHaveBeenCalled();
  });

  it('renders shortcut hints as Kbd elements', () => {
    render(
      <CommandPalette
        open
        onOpenChange={vi.fn()}
        commands={[{ id: 'save', label: 'Save', shortcut: ['⌘', 'S'], onSelect: vi.fn() }]}
      />,
    );

    const kbdElements = screen.getAllByText(/⌘|S/);
    expect(kbdElements.some((el) => el.tagName.toLowerCase() === 'kbd')).toBe(true);
  });

  it("forwards the ref to the underlying input element (SearchField's forwarded-ref contract)", () => {
    const ref = createRef<HTMLInputElement>();
    render(<CommandPalette ref={ref} open onOpenChange={vi.fn()} commands={commands} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toHaveFocus();
  });

  it('clamps the raw active index BEFORE applying the delta, so ArrowUp moves the highlight in a single press after the list shrinks', async () => {
    const user = userEvent.setup();
    const sixCommands = Array.from({ length: 6 }, (_, index) => ({
      id: `cmd-${index}`,
      label: `Command ${index}`,
      onSelect: vi.fn(),
    }));

    const { rerender } = render(
      <CommandPalette open onOpenChange={vi.fn()} commands={sixCommands} />,
    );

    const input = screen.getByRole('searchbox');

    // Press ArrowDown 5 times: raw state goes 0 -> 5 (last of 6 commands).
    for (let i = 0; i < 5; i += 1) {
      await user.keyboard('{ArrowDown}');
    }
    let activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('Command 5');

    // Shrink `commands` to 2 without the palette closing/reopening (no
    // remount, so activeIndexState is NOT reset by the open-effect).
    rerender(<CommandPalette open onOpenChange={vi.fn()} commands={sixCommands.slice(0, 2)} />);

    activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('Command 1');

    // A single ArrowUp must move the highlight immediately -- if the raw
    // state were clamped only on read (not before applying the delta), this
    // press would still display "Command 1" and require three more presses.
    await user.keyboard('{ArrowUp}');
    activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId as string)).toHaveTextContent('Command 0');
  });

  it('resets the query and active index each time it re-opens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);

    await user.type(screen.getByRole('searchbox'), 'new');
    expect(screen.queryByText('Open file')).not.toBeInTheDocument();

    rerender(<CommandPalette open={false} onOpenChange={vi.fn()} commands={commands} />);
    rerender(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.getByText('Open file')).toBeInTheDocument();
  });

  describe('focus return (#275)', () => {
    it('gives focus back to the opener when the palette closes', () => {
      render(<button type="button">Open palette</button>);
      const opener = screen.getByRole('button', { name: 'Open palette' });
      opener.focus();

      const { rerender } = render(
        <CommandPalette open onOpenChange={vi.fn()} commands={commands} />,
      );
      expect(screen.getByRole('searchbox')).toHaveFocus();

      rerender(<CommandPalette open={false} onOpenChange={vi.fn()} commands={commands} />);
      expect(opener).toHaveFocus();
    });

    it('still gives focus back under StrictMode', () => {
      render(<button type="button">Open palette</button>);
      const opener = screen.getByRole('button', { name: 'Open palette' });
      opener.focus();

      const { rerender } = render(
        <StrictMode>
          <CommandPalette open onOpenChange={vi.fn()} commands={commands} />
        </StrictMode>,
      );
      rerender(
        <StrictMode>
          <CommandPalette open={false} onOpenChange={vi.fn()} commands={commands} />
        </StrictMode>,
      );
      expect(opener).toHaveFocus();
    });

    it('does not steal focus if the opener left the page', () => {
      const { container, unmount } = render(<button type="button">Gone</button>);
      container.querySelector('button')?.focus();
      const palette = render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);
      unmount();
      expect(() =>
        palette.rerender(
          <CommandPalette open={false} onOpenChange={vi.fn()} commands={commands} />,
        ),
      ).not.toThrow();
      expect(document.body).toHaveFocus();
    });

    it('leaves focus where a command put it', async () => {
      const user = userEvent.setup();
      function Harness() {
        const [open, setOpen] = useState(true);
        return (
          <>
            <button type="button">Opener</button>
            <input aria-label="Target" />
            <CommandPalette
              open={open}
              onOpenChange={setOpen}
              commands={[
                {
                  id: 'go',
                  label: 'Go to field',
                  onSelect: () => screen.getByLabelText('Target').focus(),
                },
              ]}
            />
          </>
        );
      }
      render(<Harness />);
      await user.keyboard('{Enter}');
      expect(screen.getByLabelText('Target')).toHaveFocus();
    });
  });

  describe('groups and row detail (#275)', () => {
    const grouped = [
      { id: 'a', label: 'Alma', group: 'Residents', detail: 'Ready', onSelect: vi.fn() },
      { id: 'b', label: 'Ben', group: 'Residents', onSelect: vi.fn() },
      { id: 'c', label: 'Home', group: 'Go to', detail: '/home', onSelect: vi.fn() },
    ];

    it('draws one heading per run of the same group, and headings are not options', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={grouped} />);

      expect(screen.getAllByText('Residents')).toHaveLength(1);
      expect(screen.getAllByText('Go to')).toHaveLength(1);
      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect(screen.queryByRole('option', { name: /Residents|Go to/ })).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Residents' })).toBeInTheDocument();
      expect(
        within(screen.getByRole('group', { name: 'Residents' })).getAllByRole('option'),
      ).toHaveLength(2);
    });

    it('draws a heading again when a group returns after another', () => {
      const interleaved = [
        { id: '1', label: 'One', group: 'A', onSelect: vi.fn() },
        { id: '2', label: 'Two', group: 'B', onSelect: vi.fn() },
        { id: '3', label: 'Three', group: 'A', onSelect: vi.fn() },
      ];
      render(<CommandPalette open onOpenChange={vi.fn()} commands={interleaved} />);
      expect(screen.getAllByText('A')).toHaveLength(2);
    });

    it('treats an empty group as no group', () => {
      render(
        <CommandPalette
          open
          onOpenChange={vi.fn()}
          commands={[{ id: 'x', label: 'X', group: '', onSelect: vi.fn() }]}
        />,
      );
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });

    it('gives every option its own id across groups', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={grouped} />);
      const ids = screen.getAllByRole('option').map((option) => option.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('keeps the list flat for arrow keys: headings are skipped', async () => {
      const user = userEvent.setup();
      render(<CommandPalette open onOpenChange={vi.fn()} commands={grouped} />);
      const input = screen.getByRole('searchbox');

      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(
        document.getElementById(input.getAttribute('aria-activedescendant') as string),
      ).toHaveTextContent('Home');
    });

    it('announces detail as the row description', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={grouped} />);
      const alma = screen.getByRole('option', { name: /Alma/ });
      expect(alma).toHaveAccessibleDescription('Ready');
      expect(screen.getByRole('option', { name: /Ben/ })).not.toHaveAccessibleDescription();
    });

    it('draws no heading when no command has a group', () => {
      const { container } = render(
        <CommandPalette open onOpenChange={vi.fn()} commands={commands} />,
      );
      expect(container.ownerDocument.querySelector('.ds-command-palette__group')).toBeNull();
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });
  });

  describe('async search (#275)', () => {
    it('is controlled when query is given, and reports typing through onQueryChange', async () => {
      const user = userEvent.setup();
      const onQueryChange = vi.fn();
      render(
        <CommandPalette
          open
          onOpenChange={vi.fn()}
          commands={commands}
          query="open"
          onQueryChange={onQueryChange}
        />,
      );

      expect(screen.getByRole('searchbox')).toHaveValue('open');
      expect(screen.queryByText('New file')).not.toBeInTheDocument();
      await user.type(screen.getByRole('searchbox'), 'x');
      expect(onQueryChange).toHaveBeenLastCalledWith('openx');
      // Controlled: the value does not move until the parent says so.
      expect(screen.getByRole('searchbox')).toHaveValue('open');
    });

    it('filter={false} shows every command whatever the query', () => {
      render(
        <CommandPalette
          open
          onOpenChange={vi.fn()}
          commands={commands}
          query="zzz"
          onQueryChange={vi.fn()}
          filter={false}
        />,
      );
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });

    it('shows a busy loading row and no empty text while loading', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={[]} loading />);
      expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('status')).toHaveTextContent('Loading');
      expect(screen.queryByText('No matching commands')).not.toBeInTheDocument();
    });

    it('keeps results visible while loading more', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} loading />);
      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows an error row, and no empty text', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={[]} error="Search failed" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Search failed');
      expect(screen.queryByText('No matching commands')).not.toBeInTheDocument();
      expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-busy', 'true');
    });

    it('reports the open-time reset to a controlled parent holding a query, on every open', () => {
      const onQueryChange = vi.fn();
      const props = { onOpenChange: vi.fn(), commands, query: 'abc', onQueryChange };
      const { rerender } = render(<CommandPalette open {...props} />);
      expect(onQueryChange).toHaveBeenCalledExactlyOnceWith('');

      rerender(<CommandPalette open={false} {...props} />);
      rerender(<CommandPalette open {...props} />);
      expect(onQueryChange).toHaveBeenCalledTimes(2);
      expect(onQueryChange).toHaveBeenLastCalledWith('');
    });

    it('does not report the open-time reset to a controlled parent when already empty', () => {
      const onQueryChange = vi.fn();
      render(
        <CommandPalette
          open
          onOpenChange={vi.fn()}
          commands={commands}
          query=""
          onQueryChange={onQueryChange}
        />,
      );
      expect(onQueryChange).not.toHaveBeenCalled();
    });
  });

  describe('labels (#275)', () => {
    it('uses English defaults', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={[]} />);
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Command palette');
      expect(screen.getByRole('searchbox')).toHaveAccessibleName('Search commands');
      expect(screen.getByRole('listbox')).toHaveAccessibleName('Commands');
      expect(screen.getByText('No matching commands')).toBeInTheDocument();
    });

    it('overrides every text, and a partial override keeps the other defaults', () => {
      render(
        <CommandPalette
          open
          onOpenChange={vi.fn()}
          commands={[]}
          labels={{ title: 'Palette', search: 'Buscar', list: 'Comandos', empty: 'Nada' }}
        />,
      );
      expect(screen.getByRole('dialog')).toHaveAccessibleName('Palette');
      expect(screen.getByRole('searchbox')).toHaveAccessibleName('Buscar');
      expect(screen.getByRole('listbox')).toHaveAccessibleName('Comandos');
      expect(screen.getByText('Nada')).toBeInTheDocument();
    });

    it('overrides the loading text', () => {
      render(
        <CommandPalette
          open
          onOpenChange={vi.fn()}
          commands={[]}
          loading
          labels={{ loading: 'Cargando' }}
        />,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    });
  });

  describe('existing usage is unchanged (#275)', () => {
    it('with only `commands`, renders a flat list with no groups, status or alert', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);
      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('listbox')).not.toHaveAttribute('aria-busy');
    });
  });

  // Issue #103 named `.ds-command-palette` as needing the same `margin: auto`
  // that `.ds-dialog` was missing. It does not, and adding one would be the
  // wrong fix: the palette has no <dialog> of its own. It renders through
  // <DialogContent>, so `ds-command-palette` lands on the same element as
  // `ds-dialog` and is centred by that rule — which is exactly why
  // CommandPalette.css declares no dialog-level geometry at all.
  //
  // That reasoning is only worth as much as it is enforced. Both stylesheets
  // are mounted here, the way a consumer gets them, so if the palette ever
  // grows its own surface — or `.ds-command-palette` starts overriding the
  // margin — this fails instead of the corner-pinned dialog shipping twice.
  describe('centring under a consumer CSS reset', () => {
    stubConsumerReset('components/organisms/Dialog.css', 'components/organisms/CommandPalette.css');

    it('is centred by .ds-dialog, with no rule of its own', () => {
      render(<CommandPalette open onOpenChange={vi.fn()} commands={commands} />);

      const palette = screen.getByRole('dialog');
      expect(palette).toHaveClass('ds-dialog', 'ds-command-palette');

      const styles = getComputedStyle(palette);
      expect(styles.marginTop).toBe('auto');
      expect(styles.marginRight).toBe('auto');
      expect(styles.marginBottom).toBe('auto');
      expect(styles.marginLeft).toBe('auto');
    });
  });
});
