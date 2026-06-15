import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useCallback, useContext, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPosition } from '../hooks/useAnchoredPosition';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { cn } from '../lib/cn';

type PopoverContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext() {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error('Popover compound components must be used within Popover');
  }
  return context;
}

export type PopoverProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function Popover({ open: controlledOpen, onOpenChange, children }: PopoverProps) {
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  useAnchoredPosition(open, triggerRef, contentRef);
  useClickOutside([triggerRef, contentRef], () => handleOpenChange(false), open);
  useEscapeKey(() => handleOpenChange(false), open);

  return (
    <PopoverContext.Provider
      value={{ open, onOpenChange: handleOpenChange, triggerRef, contentRef, contentId }}
    >
      {children}
    </PopoverContext.Provider>
  );
}

export type PopoverTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  function PopoverTrigger({ className, onClick, children, ...props }, ref) {
    const { open, onOpenChange, triggerRef, contentId } = usePopoverContext();

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
        className={cn('ds-popover__trigger', className)}
        aria-expanded={open}
        aria-controls={contentId}
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

export type PopoverContentProps = HTMLAttributes<HTMLDivElement>;

export function PopoverContent({ className, children, ...props }: PopoverContentProps) {
  const { open, contentRef, contentId } = usePopoverContext();

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      ref={contentRef}
      id={contentId}
      role="dialog"
      className={cn('ds-popover__content', className)}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}
