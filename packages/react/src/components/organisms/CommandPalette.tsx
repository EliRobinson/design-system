import type { KeyboardEvent, ReactNode } from 'react';
import { forwardRef, useCallback, useEffect, useId, useRef } from 'react';

import { cn } from '../../lib/cn.js';
import { useMergedRef } from '../../lib/useMergedRef.js';
import { useActiveDescendant } from '../../hooks/useActiveDescendant.js';
import { useControllableState } from '../../hooks/useControllableState.js';
import { Kbd } from '../atoms/Kbd.js';
import { SearchField } from '../molecules/SearchField.js';
import { Dialog, DialogContent, DialogTitle } from './Dialog.js';

export type CommandPaletteCommand = {
  id: string;
  label: string;
  shortcut?: string[];
  /** Heading the row sits under. A heading is drawn whenever `group` differs
   * from the previous command's, so the caller's order is the group order. */
  group?: string;
  /** A second, quieter line on the row. Announced as the row's description. */
  detail?: string;
  onSelect: () => void;
};

export type CommandPaletteLabels = {
  title: string;
  search: string;
  list: string;
  empty: string;
  loading: string;
};

const DEFAULT_LABELS: CommandPaletteLabels = {
  title: 'Command palette',
  search: 'Search commands',
  list: 'Commands',
  empty: 'No matching commands',
  loading: 'Loading',
};

type Row = { command: CommandPaletteCommand; index: number };
type Section = { group: string | undefined; rows: Row[] };

/** Split the flat list into runs of neighbours sharing a `group`. The flat
 * `index` is kept on each row, so arrow keys never see the headings. */
function toSections(commands: CommandPaletteCommand[]): Section[] {
  const sections: Section[] = [];
  commands.forEach((command, index) => {
    const last = sections[sections.length - 1];
    if (last && last.group === command.group) {
      last.rows.push({ command, index });
    } else {
      sections.push({ group: command.group, rows: [{ command, index }] });
    }
  });
  return sections;
}

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandPaletteCommand[];
  /** Controlled search text. Omit it and the palette keeps its own. */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Turn the built-in label filter off, for results the caller already searched. */
  filter?: boolean;
  /** Results are on their way. Shows a busy row; current results stay. */
  loading?: boolean;
  /** The search failed. Shown as an alert row in place of the empty text. */
  error?: ReactNode;
  /** English defaults; give only the texts you translate. */
  labels?: Partial<CommandPaletteLabels>;
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
  function CommandPalette(
    {
      open,
      onOpenChange,
      commands,
      query: controlledQuery,
      onQueryChange,
      filter = true,
      loading = false,
      error,
      labels,
      className,
    },
    ref,
  ) {
    const baseId = useId();
    const listId = `${baseId}-list`;
    const text = { ...DEFAULT_LABELS, ...labels };

    const [query, setQuery] = useControllableState({
      value: controlledQuery,
      defaultValue: '',
      onChange: onQueryChange,
    });
    const queryRef = useRef(query);
    queryRef.current = query;

    // A single ref prop can only point one direction, but both this
    // component (to focus the input on open) and a consumer (via the
    // forwarded `ref`) need the underlying input node.
    const inputRef = useRef<HTMLInputElement>(null);
    const setInputRef = useMergedRef<HTMLInputElement>(inputRef, ref);

    const filtered = filter
      ? commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()))
      : commands;

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
        if (queryRef.current !== '') {
          setQuery('');
        }
        setActiveIndex(0);
        inputRef.current?.focus();
      }
    }, [open, setActiveIndex, setQuery]);

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

    function renderRow({ command, index }: Row) {
      const detailId = `${baseId}-detail-${index}`;
      return (
        <li key={command.id} role="presentation">
          <div
            {...getOptionProps(index)}
            aria-describedby={command.detail ? detailId : undefined}
            className={cn(
              'ds-command-palette__item',
              index === activeIndex && 'ds-command-palette__item--active',
            )}
          >
            <span className="ds-command-palette__text">
              <span>{command.label}</span>
              {command.detail ? (
                <span id={detailId} className="ds-command-palette__detail">
                  {command.detail}
                </span>
              ) : null}
            </span>
            {command.shortcut ? (
              <span className="ds-command-palette__shortcut">
                {command.shortcut.map((key, keyIndex) => (
                  <Kbd key={`${command.id}-${keyIndex}`}>{key}</Kbd>
                ))}
              </span>
            ) : null}
          </div>
        </li>
      );
    }

    if (!open) {
      return null;
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('ds-command-palette', className)}>
          <DialogTitle>{text.title}</DialogTitle>
          <SearchField
            ref={setInputRef}
            aria-label={text.search}
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
          <ul
            id={listId}
            role="listbox"
            aria-label={text.list}
            aria-busy={loading ? true : undefined}
            className="ds-command-palette__list"
          >
            {toSections(filtered).map((section) =>
              !section.group ? (
                section.rows.map(renderRow)
              ) : (
                <li key={`${section.group}-${section.rows[0].command.id}`} role="presentation">
                  <div
                    id={`${baseId}-group-${section.rows[0].index}`}
                    aria-hidden="true"
                    className="ds-command-palette__group"
                  >
                    {section.group}
                  </div>
                  <ul
                    role="group"
                    aria-labelledby={`${baseId}-group-${section.rows[0].index}`}
                    className="ds-command-palette__group-list"
                  >
                    {section.rows.map(renderRow)}
                  </ul>
                </li>
              ),
            )}
          </ul>
          {/* Always mounted: a live region that arrives already filled is often
              not announced. Only its text changes. */}
          <div className="ds-command-palette__status" role="status">
            {loading ? text.loading : null}
          </div>
          {error ? (
            <div
              className="ds-command-palette__status ds-command-palette__status--error"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {filtered.length === 0 && !loading && !error ? (
            <div className="ds-command-palette__status">{text.empty}</div>
          ) : null}
        </DialogContent>
      </Dialog>
    );
  },
);
