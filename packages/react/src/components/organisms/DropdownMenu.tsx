import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useContext, useEffect, useMemo, useState } from 'react';

import { cn } from '../../lib/cn.js';
import type {
  AnchoredOverlayContentProps,
  AnchoredOverlayContextValue,
} from './overlay/anchoredOverlay.js';
import {
  AnchoredOverlayContent,
  AnchoredOverlayTrigger,
  useAnchoredOverlay,
} from './overlay/anchoredOverlay.js';

type DropdownMenuContextValue = AnchoredOverlayContextValue & {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error('DropdownMenu compound components must be used within DropdownMenu');
  }
  return context;
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
  const [activeIndex, setActiveIndex] = useState(-1);

  // The roving highlight is only meaningful while the menu is on screen, so a
  // closed menu always reopens on nothing. Keyed off the resolved state rather
  // than the close callback so a controlled consumer closing via the `open`
  // prop resets it too.
  useEffect(() => {
    if (!overlay.open) {
      setActiveIndex(-1);
    }
  }, [overlay.open]);

  const context = useMemo(
    () => ({ ...overlay, activeIndex, setActiveIndex }),
    [overlay, activeIndex],
  );

  return <DropdownMenuContext.Provider value={context}>{children}</DropdownMenuContext.Provider>;
}

export type DropdownMenuTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger({ className, ...props }, ref) {
    const overlay = useDropdownMenuContext();

    return (
      <AnchoredOverlayTrigger
        ref={ref}
        overlay={overlay}
        className={cn('ds-dropdown__trigger', className)}
        aria-haspopup="menu"
        {...props}
      />
    );
  },
);

/** `side` and `align` are forwarded to the positioner. `align: 'end'` pins the
 * menu's right edge to the trigger's, which is what a trigger near the right
 * edge of the viewport needs — see `useAnchoredPosition`. */
export type DropdownMenuContentProps = HTMLAttributes<HTMLDivElement> &
  Pick<AnchoredOverlayContentProps, 'side' | 'align'>;

export function DropdownMenuContent({
  className,
  side,
  align,
  ...props
}: DropdownMenuContentProps) {
  const context = useDropdownMenuContext();
  const { onOpenChange, contentRef, activeIndex, setActiveIndex } = context;

  return (
    <AnchoredOverlayContent
      overlay={context}
      side={side}
      align={align}
      role="menu"
      className={cn('ds-dropdown__content', className)}
      onKeyDown={(event) => {
        // DOM focus moves with the highlight here, unlike the
        // aria-activedescendant widgets: menu items are real buttons, so the
        // menu is queried live rather than kept in state — items can be
        // rendered conditionally by the consumer.
        const items = contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        if (!items?.length) {
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const next = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
          setActiveIndex(next);
          items[next]?.focus();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          const next = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
          setActiveIndex(next);
          items[next]?.focus();
        } else if (event.key === 'Home') {
          event.preventDefault();
          setActiveIndex(0);
          items[0]?.focus();
        } else if (event.key === 'End') {
          event.preventDefault();
          const last = items.length - 1;
          setActiveIndex(last);
          items[last]?.focus();
        } else if (event.key === 'Tab') {
          onOpenChange(false);
        }
      }}
      {...props}
    />
  );
}

export type DropdownMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  inset?: boolean;
};

export const DropdownMenuItem = forwardRef<HTMLButtonElement, DropdownMenuItemProps>(
  function DropdownMenuItem({ className, inset, onClick, ...props }, ref) {
    const { onOpenChange } = useDropdownMenuContext();

    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        className={cn('ds-dropdown__item', inset && 'ds-dropdown__item--inset', className)}
        onClick={(event) => {
          onClick?.(event);
          onOpenChange(false);
        }}
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
