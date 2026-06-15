import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useCallback, useContext, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPosition } from '../hooks/useAnchoredPosition';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { cn } from '../lib/cn';

type DropdownMenuContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  menuId: string;
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

export function DropdownMenu({ open: controlledOpen, onOpenChange, children }: DropdownMenuProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(next);
      }
      if (!next) {
        setActiveIndex(-1);
      }
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  useAnchoredPosition(open, triggerRef, contentRef);
  useClickOutside([triggerRef, contentRef], () => handleOpenChange(false), open);
  useEscapeKey(() => handleOpenChange(false), open);

  return (
    <DropdownMenuContext.Provider
      value={{
        open,
        onOpenChange: handleOpenChange,
        triggerRef,
        contentRef,
        menuId,
        activeIndex,
        setActiveIndex,
      }}
    >
      {children}
    </DropdownMenuContext.Provider>
  );
}

export type DropdownMenuTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const DropdownMenuTrigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  function DropdownMenuTrigger({ className, onClick, children, ...props }, ref) {
    const { open, onOpenChange, triggerRef, menuId } = useDropdownMenuContext();

    const setRefs = useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref, triggerRef],
    );

    return (
      <button
        ref={setRefs}
        type="button"
        className={cn('ds-dropdown__trigger', className)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(event) => {
          onClick?.(event);
          onOpenChange(!open);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

export type DropdownMenuContentProps = HTMLAttributes<HTMLDivElement>;

export function DropdownMenuContent({ className, children, ...props }: DropdownMenuContentProps) {
  const { open, onOpenChange, contentRef, menuId, activeIndex, setActiveIndex } =
    useDropdownMenuContext();

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={contentRef}
      id={menuId}
      role="menu"
      className={cn('ds-dropdown__content', className)}
      onKeyDown={(event) => {
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
    >
      {children}
    </div>,
    document.body,
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
