import type { KeyboardEvent } from 'react';
import { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../lib/cn.js';
import { useMergedRef } from '../../lib/useMergedRef.js';
import { useActiveDescendant } from '../../hooks/useActiveDescendant.js';
import { Kbd } from '../atoms/Kbd.js';
import { SearchField } from '../molecules/SearchField.js';
import { Dialog, DialogContent, DialogTitle } from './Dialog.js';

export type CommandPaletteCommand = {
  id: string;
  label: string;
  shortcut?: string[];
  onSelect: () => void;
};

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandPaletteCommand[];
  className?: string;
};

// `Dialog` (organisms/Dialog.tsx) is a context provider ONLY -- the actual
// <dialog> element, showModal()/close(), the backdrop, aria-labelledby, and
// close-on-backdrop-click all live in `DialogContent`. Wrapping the palette
// body in a bare <div> inside <Dialog> (as an earlier draft of this task
// did) renders no role="dialog", no modality, no focus trap, and no Escape
// handling -- it's an inert <div> that happens to be positioned by nothing.
// `DialogContent` must be the thing that actually wraps the palette markup,
// and its `aria-labelledby` points at the id the surrounding `Dialog` minted
// for its title, which dangles without a `DialogTitle` -- so one is always
// rendered here too.
//
// CommandPaletteProps is a closed set, mirroring Combobox: no HTML-attribute
// passthrough and no trailing `{...props}` spread anywhere below, so a
// consumer cannot clobber the internally computed ids, roles, or the
// aria-activedescendant wiring this component owns.
export const CommandPalette = forwardRef<HTMLInputElement, CommandPaletteProps>(
  function CommandPalette({ open, onOpenChange, commands, className }, ref) {
    const baseId = useId();
    const listId = `${baseId}-list`;

    const [query, setQuery] = useState('');

    // A single ref prop can only point one direction, but both this
    // component (to focus the input on open) and a consumer (via the
    // forwarded `ref`) need the underlying input node.
    const inputRef = useRef<HTMLInputElement>(null);
    const setInputRef = useMergedRef<HTMLInputElement>(inputRef, ref);

    const filtered = commands.filter((command) =>
      command.label.toLowerCase().includes(query.toLowerCase()),
    );

    const runCommand = useCallback(
      (index: number) => {
        const command = filtered[index];
        if (!command) {
          return;
        }
        command.onSelect();
        onOpenChange(false);
      },
      [filtered, onOpenChange],
    );

    const { activeIndex, activeId, setActiveIndex, moveActive, getOptionProps } =
      useActiveDescendant({ count: filtered.length, baseId, onSelect: runCommand });

    // Every time the palette opens, start from a clean slate and move focus
    // to the search input. Focusing via `inputRef` relies on SearchField's
    // forwarded-ref contract (ref resolves to the real <input>) -- see
    // SearchField.test.tsx for the permanent test covering that contract.
    useEffect(() => {
      if (open) {
        setQuery('');
        setActiveIndex(0);
        inputRef.current?.focus();
      }
    }, [open, setActiveIndex]);

    // Focus stays on the input at all times; the active item is tracked via
    // aria-activedescendant rather than moving DOM focus into the list.
    // Shared with Combobox via useActiveDescendant rather than introducing a
    // second focus-management convention: keyboard users keep typing to refine
    // the filter without losing their place.
    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          moveActive(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveActive(-1);
          break;
        case 'Enter':
          event.preventDefault();
          runCommand(activeIndex);
          break;
        case 'Escape':
          // In a real browser, the native <dialog> element (owned by
          // DialogContent) also closes on Escape on its own via its
          // built-in cancel behavior, which fires DialogContent's
          // `onClose` -> `onOpenChange(false)`. DialogContent itself never
          // attaches a JS keydown listener for this, so handling Escape
          // here is not double-handling a listener -- it's covering the one
          // environment where the native behavior doesn't happen at all:
          // jsdom's `showModal` polyfill (test/setup.ts) only flips
          // `.open`, it does not simulate Escape/cancel. Without this
          // handler, Escape would be silently untested here and would only
          // work in real browsers by coincidence of native <dialog>
          // behavior rather than by anything this component does.
          event.preventDefault();
          onOpenChange(false);
          break;
        default:
          break;
      }
    }

    if (!open) {
      return null;
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('ds-command-palette', className)}>
          <DialogTitle>Command palette</DialogTitle>
          <SearchField
            ref={setInputRef}
            aria-label="Search commands"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <ul id={listId} role="listbox" aria-label="Commands" className="ds-command-palette__list">
            {filtered.map((command, index) => (
              <li key={command.id} role="presentation">
                <div
                  {...getOptionProps(index)}
                  className={cn(
                    'ds-command-palette__item',
                    index === activeIndex && 'ds-command-palette__item--active',
                  )}
                >
                  <span>{command.label}</span>
                  {command.shortcut ? (
                    <span className="ds-command-palette__shortcut">
                      {command.shortcut.map((key, keyIndex) => (
                        <Kbd key={`${command.id}-${keyIndex}`}>{key}</Kbd>
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="ds-command-palette__empty" role="presentation">
                No matching commands
              </li>
            ) : null}
          </ul>
        </DialogContent>
      </Dialog>
    );
  },
);
