import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  MutableRefObject,
  ReactNode,
} from 'react';
import { createContext, forwardRef, useContext, useEffect, useMemo, useRef } from 'react';

import { cn } from '../../lib/cn.js';
import { Mark } from '../../lib/marks.js';
import { useLatest } from '../../lib/useLatest.js';
import type {
  AnchoredOverlayContentProps,
  AnchoredOverlayContextValue,
} from './overlay/anchoredOverlay.js';
import {
  AnchoredOverlayContent,
  AnchoredOverlayTrigger,
  useAnchoredOverlay,
} from './overlay/anchoredOverlay.js';

/* The WAI-ARIA menu button pattern (#273). The content is portalled to the end
 * of <body>, so focus has to be carried into it on open and back to the
 * trigger on the way out — nothing in the page's tab order leads there.
 *
 * Items are real buttons and DOM focus moves with the highlight, so the menu is
 * queried live rather than kept in state: a consumer can render items
 * conditionally, and the next item is always worked out from the one that has
 * focus now. */

const ITEM_ROLES = ['menuitem', 'menuitemcheckbox', 'menuitemradio'] as const;
type ItemRole = (typeof ITEM_ROLES)[number];

/* "Disabled" is `disabled` or `aria-disabled="true"`, everywhere in this file:
   the selector below for the live DOM, `isItemDisabled` for props at render,
   and `.ds-dropdown__item:disabled, [aria-disabled='true']` in the stylesheet. */
const ENABLED_ITEM_SELECTOR = ITEM_ROLES.map(
  (role) => `[role="${role}"]:not(:disabled):not([aria-disabled="true"])`,
).join(', ');

function isItemDisabled(props: {
  disabled?: boolean;
  'aria-disabled'?: boolean | 'true' | 'false';
}) {
  return Boolean(props.disabled) || String(props['aria-disabled']) === 'true';
}

function itemClassName(inset: boolean | undefined, className: string | undefined) {
  return cn('ds-dropdown__item', inset && 'ds-dropdown__item--inset', className);
}

/** Which end of the menu focus lands on when it opens. */
type OpenEdge = 'first' | 'last';

type DropdownMenuContextValue = AnchoredOverlayContextValue & {
  /** Set by the trigger just before it opens the menu; read once on open. */
  openEdgeRef: MutableRefObject<OpenEdge>;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('DropdownMenu compound components must be used within DropdownMenu');
  }
  return context;
}

/** Where focus goes: an end of the menu, or one step on from the focused item. */
type FocusTarget = OpenEdge | 'next' | 'previous';

/** The keys that move focus inside an open menu. */
const KEY_TARGETS: Partial<Record<string, FocusTarget>> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  Home: 'first',
  End: 'last',
};

/**
 * Focuses the enabled item `target` names, wrapping at both ends. With no
 * enabled item focused — on open, or after a click on an aria-disabled one —
 * `next` lands on the first item and `previous` on the last.
 *
 * Not `useRovingFocus`: that hook takes both axes (a menu keeps ←/→ for
 * submenus) and does nothing until an item has focus, and focus starts on the
 * trigger here.
 */
function focusItem(content: HTMLElement | null, target: FocusTarget) {
  const items = Array.from(content?.querySelectorAll<HTMLElement>(ENABLED_ITEM_SELECTOR) ?? []);
  const last = items.length - 1;
  const focused = items.indexOf(document.activeElement as HTMLElement);

  const index =
    target === 'first' || (target === 'next' && focused === -1)
      ? 0
      : target === 'last' || focused === -1
        ? last
        : target === 'next'
          ? (focused + 1) % items.length
          : (focused - 1 + items.length) % items.length;

  items[index]?.focus({ preventScroll: true });
}

export type DropdownMenuProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function DropdownMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: DropdownMenuProps) {
  const overlay = useAnchoredOverlay({ open, defaultOpen, onOpenChange });
  const openEdgeRef = useRef<OpenEdge>('first');
  const { open: isOpen, contentRef } = overlay;

  // Focus moves in on the closed → open change only. A menu that starts open
  // (a story, a test, a controlled consumer restoring state) did not just
  // receive a user's request, and taking focus on page load would be a theft.
  // A parent's effect runs after its children's, so the portal is in the DOM
  // by now.
  const wasOpen = useRef(isOpen);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      focusItem(contentRef.current, openEdgeRef.current);
      openEdgeRef.current = 'first';
    }
    wasOpen.current = isOpen;
  }, [isOpen, contentRef]);

  const context = useMemo(() => ({ ...overlay, openEdgeRef }), [overlay]);

  return <DropdownMenuContext.Provider value={context}>{children}</DropdownMenuContext.Provider>;
}

export type DropdownMenuTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger({ className, onClick, onKeyDown, ...props }, ref) {
    const overlay = useDropdownMenuContext();
    const { open, onOpenChange, contentRef, openEdgeRef } = overlay;

    return (
      <AnchoredOverlayTrigger
        ref={ref}
        overlay={overlay}
        className={cn('ds-dropdown__trigger', className)}
        aria-haspopup="menu"
        onClick={(event) => {
          // Every trigger path names its edge, so an ArrowUp a controlled
          // consumer refused to open on cannot leak into the next click.
          // DropdownMenu's open effect resets it after use for other opens.
          openEdgeRef.current = 'first';
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          // Choosing an item with Enter hands focus back here mid-keydown, so
          // a held key's next repeat lands on the trigger and its native click
          // would open the menu again. The content's capture handler is the
          // same guard in the other direction.
          if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            return;
          }
          if (event.defaultPrevented || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) {
            return;
          }
          // ↓ opens on the first item, ↑ on the last, as the pattern has it.
          event.preventDefault();
          const edge = event.key === 'ArrowDown' ? 'first' : 'last';
          if (open) {
            focusItem(contentRef.current, edge);
          } else {
            openEdgeRef.current = edge;
            onOpenChange(true);
          }
        }}
        {...props}
      />
    );
  },
);

/** Keep it rendered rather than mounting it only while open: it already
 * renders nothing while closed, and content that mounts on the same render as
 * the open misses the move of focus into the menu (the portal arrives one
 * render later).
 *
 * `side` and `align` are forwarded to the positioner. `align: 'end'` pins the
 * menu's right edge to the trigger's, which is what a trigger near the right
 * edge of the viewport needs — see `useAnchoredPosition`. */
export type DropdownMenuContentProps = HTMLAttributes<HTMLDivElement> &
  Pick<AnchoredOverlayContentProps, 'side' | 'align'>;

export function DropdownMenuContent({
  className,
  side,
  align,
  onKeyDown,
  onKeyDownCapture,
  ...props
}: DropdownMenuContentProps) {
  const context = useDropdownMenuContext();
  const { contentRef, closeToTrigger } = context;

  return (
    <AnchoredOverlayContent
      overlay={context}
      side={side}
      align={align}
      role="menu"
      className={cn('ds-dropdown__content', className)}
      onKeyDownCapture={(event) => {
        onKeyDownCapture?.(event);
        // Enter on the trigger opens the menu and moves focus to the first
        // item, so a held key's auto-repeat lands there and would choose it.
        // Cancelling the repeat stops a button's click; the checkable items
        // check `event.repeat` themselves.
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) {
          return;
        }

        const target = KEY_TARGETS[event.key];
        if (target) {
          event.preventDefault();
          focusItem(contentRef.current, target);
        } else if (event.key === 'Tab') {
          // Not prevented: with focus back on the trigger, the browser's own
          // Tab carries on from there, to the control after the trigger (or
          // before it, with Shift) rather than off the end of <body>.
          closeToTrigger();
        }
      }}
      {...props}
    />
  );
}

type ItemBehaviourProps = {
  inset?: boolean;
  /**
   * Whether choosing this item closes the menu. Defaults to `true` for an
   * ordinary item, and to `false` when `type="submit"` — closing unmounts the
   * portal during the click, which cancels the form submission the click was
   * for. Set it explicitly to override either default.
   *
   * On a checkbox or radio item it governs a click and Enter; Space always
   * leaves the menu open, so a user can set several in a row.
   */
  closeOnSelect?: boolean;
};

export type DropdownMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & ItemBehaviourProps;

export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  function DropdownMenuItem(
    { className, inset, closeOnSelect, onClick, type = 'button', ...props },
    ref,
  ) {
    const { closeToTrigger } = useDropdownMenuContext();
    const disabled = isItemDisabled(props);

    // Closing is a discrete update React flushes synchronously, still inside the
    // click dispatch — `AnchoredOverlayContent` returns null and the portal
    // unmounts before the browser gets to the click's default action. For an
    // ordinary item that is exactly what's wanted; for `type="submit"` it
    // destroys the thing the click was for. React has already suppressed the
    // browser's own submission so it can run the form's `action` itself, and by
    // then there is no live fiber to run it against, so both paths are gone and
    // the item reads as dead (issue #179). A submit item therefore stays open
    // unless the consumer asks otherwise — usually the action navigates or the
    // consumer closes the menu when it resolves.
    const shouldClose = closeOnSelect ?? type !== 'submit';

    return (
      <button
        ref={ref}
        type={type}
        role="menuitem"
        className={itemClassName(inset, className)}
        onClick={(event) => {
          // aria-disabled keeps the button clickable, so it is stopped here —
          // including a submit item's form submission.
          if (disabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
          if (shouldClose) {
            closeToTrigger();
          }
        }}
        {...props}
      />
    );
  },
);

/* --------------------------------------------------------------------------
   Checkable items

   The checkbox and the radio item are one button with two answers to "what is
   checked, and what does choosing change". Everything else — the indicator
   slot, the Enter/Space split, the disabled check, closing — lives here once.
   -------------------------------------------------------------------------- */

type CheckableItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'role' | 'type'> &
  ItemBehaviourProps & {
    role: Exclude<ItemRole, 'menuitem'>;
    checked: boolean;
    onSelect: () => void;
    indicator: ReactNode;
  };

const CheckableItem = forwardRef<HTMLButtonElement, CheckableItemProps>(function CheckableItem(
  {
    className,
    inset,
    closeOnSelect = true,
    role,
    checked,
    onSelect,
    indicator,
    onClick,
    onKeyDown,
    onKeyUp,
    children,
    ...props
  },
  ref,
) {
  const { closeToTrigger } = useDropdownMenuContext();
  const disabled = isItemDisabled(props);

  function choose(close: boolean) {
    onSelect();
    if (close) {
      closeToTrigger();
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      role={role}
      aria-checked={checked}
      className={itemClassName(inset, className)}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        // The same guard as DropdownMenuItem's: aria-disabled leaves the
        // button clickable, so nothing of the consumer's runs either.
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
        if (!event.defaultPrevented) {
          choose(closeOnSelect);
        }
      }}
      // The keys are handled here rather than left to the button's own click,
      // because the pattern gives them different meanings: Enter chooses and
      // closes, Space chooses and stays. Both defaults are cancelled so the
      // native click does not choose a second time.
      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        // Cancel the native click in every case; choose only on a fresh,
        // enabled press the consumer did not cancel.
        const skip = event.repeat || event.defaultPrevented || disabled;
        event.preventDefault();
        if (!skip) {
          choose(event.key === 'Enter' && closeOnSelect);
        }
      }}
      onKeyUp={(event: KeyboardEvent<HTMLButtonElement>) => {
        onKeyUp?.(event);
        // A button fires its Space click on key-up.
        if (event.key === ' ') {
          event.preventDefault();
        }
      }}
      {...props}
    >
      {/* Always rendered, so the label sits in the same place checked or not. */}
      <span className="ds-dropdown__indicator" aria-hidden="true">
        {checked ? indicator : null}
      </span>
      {children}
    </button>
  );
});

/* Why the checkable items are controlled only (#273)
   ----------------------------------------------------
   The menu's content unmounts when it closes — `AnchoredOverlayContent`
   renders nothing while closed — and every item goes with it. State an item
   kept for itself (a `defaultChecked`, a group's `defaultValue`) would reset
   to its default each time the menu reopened, so a checkbox would "forget"
   being ticked. The value therefore lives with the consumer: `checked` and
   `onCheckedChange`, `value` and `onValueChange`, as Radix and shadcn have it. */

type CheckableOwnProps = 'role' | 'type' | 'aria-checked' | 'onSelect';

export type DropdownMenuCheckboxItemProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  CheckableOwnProps | 'defaultChecked'
> &
  ItemBehaviourProps & {
    /** Whether the item is checked. Owned by the caller — see "controlled only" above. */
    checked: boolean;
    /** Called with the state the user asked for. The item shows it once `checked` changes. */
    onCheckedChange?: (checked: boolean) => void;
  };

/** A menu item that turns a setting on or off: `role="menuitemcheckbox"`.
 * Controlled only: the menu unmounts its items on close, so it cannot keep the
 * state itself. */
export const DropdownMenuCheckboxItem = forwardRef<
  HTMLButtonElement,
  DropdownMenuCheckboxItemProps
>(function DropdownMenuCheckboxItem({ checked, onCheckedChange, ...props }, ref) {
  return (
    <CheckableItem
      ref={ref}
      role="menuitemcheckbox"
      checked={checked}
      onSelect={() => onCheckedChange?.(!checked)}
      indicator={<Mark name="check" />}
      {...props}
    />
  );
});

type RadioGroupContextValue = {
  value: string;
  select: (value: string) => void;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export type DropdownMenuRadioGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue'> & {
  /** The checked item's value. Owned by the caller — see "controlled only" above. */
  value: string;
  /** Called when a different item is chosen. Choosing the checked item again is not a change. */
  onValueChange?: (value: string) => void;
};

/** A set of `DropdownMenuRadioItem`s, one of which is checked. Controlled
 * only, for the same reason as the checkbox item. Give it an
 * `aria-label` (or `aria-labelledby` a `DropdownMenuLabel`) when the menu holds
 * more than one group. */
export function DropdownMenuRadioGroup({
  value,
  onValueChange,
  ...props
}: DropdownMenuRadioGroupProps) {
  const latestOnValueChange = useLatest(onValueChange);

  const context = useMemo(
    () => ({
      value,
      select: (next: string) => {
        if (next !== value) {
          latestOnValueChange.current?.(next);
        }
      },
    }),
    [value, latestOnValueChange],
  );

  return (
    <RadioGroupContext.Provider value={context}>
      <div role="group" {...props} />
    </RadioGroupContext.Provider>
  );
}

export type DropdownMenuRadioItemProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  CheckableOwnProps | 'value'
> &
  ItemBehaviourProps & {
    /** The group's value when this item is the checked one. */
    value: string;
  };

/** One choice in a `DropdownMenuRadioGroup`: `role="menuitemradio"`. */
export const DropdownMenuRadioItem = forwardRef<HTMLButtonElement, DropdownMenuRadioItemProps>(
  function DropdownMenuRadioItem({ value, ...props }, ref) {
    const group = useContext(RadioGroupContext);
    if (!group) {
      throw new Error('DropdownMenuRadioItem must be used within DropdownMenuRadioGroup');
    }

    return (
      <CheckableItem
        ref={ref}
        role="menuitemradio"
        checked={group.value === value}
        onSelect={() => group.select(value)}
        indicator={<span className="ds-dropdown__dot" />}
        {...props}
      />
    );
  },
);

export type DropdownMenuLabelProps = HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

export function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps) {
  return (
    <div
      role="presentation"
      className={cn('ds-dropdown__label', inset && 'ds-dropdown__label--inset', className)}
      {...props}
    />
  );
}

export type DropdownMenuSeparatorProps = HTMLAttributes<HTMLDivElement>;

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps) {
  return (
    <div
      role="separator"
      className={cn('ds-dropdown__separator', className)}
      aria-orientation="horizontal"
      {...props}
    />
  );
}
