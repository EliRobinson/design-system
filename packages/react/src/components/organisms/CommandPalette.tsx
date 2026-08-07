import type { KeyboardEvent } from 'react';
import { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { Kbd } from '../atoms/Kbd';
import { SearchField } from '../molecules/SearchField';
import { Dialog, DialogContent, DialogTitle } from './Dialog';

export type CommandPaletteCommand = {
  id: string;
  label: string;
  shortcut?: string[];
  onSelect: () => void;
};

export type CommandPaletteProps = {
  isOpen: boolean;
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
// and it hardcodes `aria-labelledby="ds-dialog-title"`, which dangles
// without a `DialogTitle` -- so one is always rendered here too.
//
// CommandPaletteProps is a closed set, mirroring Combobox's pattern
// (A7/A12): no HTML-attribute passthrough and no trailing `{...props}`
// spread anywhere below, so there is no surface for a consumer -- typed or
// not -- to clobber the internally computed `id`s, `role`s, or the
// `aria-activedescendant` wiring this component owns.
export const CommandPalette = forwardRef<HTMLInputElement, CommandPaletteProps>(
  function CommandPalette({ isOpen, onOpenChange, commands, className }, ref) {
    const baseId = useId();
    const listId = `${baseId}-list`;

    const [query, setQuery] = useState('');
    const [activeIndexState, setActiveIndexState] = useState(0);

    // A single ref prop can only point one direction, but both this
    // component (to focus the input on open) and a consumer (via the
    // forwarded `ref`) need the underlying input node. Merge them, same
    // pattern as DialogContent's `setRefs`.
    const inputRef = useRef<HTMLInputElement>(null);
    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const filtered = commands.filter((command) =>
      command.label.toLowerCase().includes(query.toLowerCase()),
    );
    // Clamp rather than trust activeIndexState: narrowing the query can
    // shrink `filtered` out from under a previously-valid index. An
    // unclamped index here would hand aria-activedescendant a dangling id
    // (same category of bug Combobox's activeIndex clamp guards against).
    const activeIndex =
      filtered.length === 0 ? -1 : Math.min(activeIndexState, filtered.length - 1);
    const activeCommand = activeIndex >= 0 ? filtered[activeIndex] : undefined;
    const activeId = activeCommand ? `${baseId}-item-${activeIndex}` : undefined;

    // Every time the palette opens, start from a clean slate and move focus
    // to the search input. Focusing via `inputRef` relies on SearchField's
    // forwarded-ref contract (ref resolves to the real <input>) -- see
    // SearchField.test.tsx for the permanent test covering that contract.
    useEffect(() => {
      if (isOpen) {
        setQuery('');
        setActiveIndexState(0);
        inputRef.current?.focus();
      }
    }, [isOpen]);

    function runCommand(index: number) {
      const command = filtered[index];
      if (!command) {
        return;
      }
      command.onSelect();
      onOpenChange(false);
    }

    // Focus stays on the input at all times; the active item is tracked via
    // aria-activedescendant rather than moving DOM focus into the list.
    // This matches Combobox (Task 18) rather than introducing a second
    // focus-management convention: keyboard users keep typing to refine the
    // filter without losing their place, and it keeps exactly one pattern
    // across the library's two aria-activedescendant-driven components.
    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndexState((current) =>
            filtered.length === 0 ? 0 : Math.min(filtered.length - 1, Math.max(0, current) + 1),
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndexState((current) => Math.max(0, current - 1));
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

    if (!isOpen) {
      return null;
    }

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
              setActiveIndexState(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <ul id={listId} role="listbox" aria-label="Commands" className="ds-command-palette__list">
            {filtered.map((command, index) => (
              <li key={command.id} role="presentation">
                <div
                  id={`${baseId}-item-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  tabIndex={-1}
                  className={cn(
                    'ds-command-palette__item',
                    index === activeIndex && 'ds-command-palette__item--active',
                  )}
                  // Prevent the option row from ever stealing DOM focus away
                  // from the input on mousedown -- same reasoning as
                  // Combobox: focus must stay on the input at all times.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndexState(index)}
                  onClick={() => runCommand(index)}
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
