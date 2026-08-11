import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useContext } from 'react';

import { cn } from '../../lib/cn';
import type { AnchoredOverlayContextValue } from './overlay/anchoredOverlay';
import {
  AnchoredOverlayContent,
  AnchoredOverlayTrigger,
  useAnchoredOverlay,
} from './overlay/anchoredOverlay';

const PopoverContext = createContext<AnchoredOverlayContextValue | null>(null);

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

export function Popover({ open, defaultOpen = false, onOpenChange, children }: PopoverProps) {
  const overlay = useAnchoredOverlay({ open, defaultOpen, onOpenChange });

  return <PopoverContext.Provider value={overlay}>{children}</PopoverContext.Provider>;
}

export type PopoverTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const PopoverTrigger = forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  function PopoverTrigger({ className, ...props }, ref) {
    const overlay = usePopoverContext();

    return (
      <AnchoredOverlayTrigger
        ref={ref}
        overlay={overlay}
        className={cn('ds-popover__trigger', className)}
        {...props}
      />
    );
  },
);

export type PopoverContentProps = HTMLAttributes<HTMLDivElement>;

export function PopoverContent({ className, ...props }: PopoverContentProps) {
  const overlay = usePopoverContext();

  return (
    <AnchoredOverlayContent
      overlay={overlay}
      role="dialog"
      className={cn('ds-popover__content', className)}
      {...props}
    />
  );
}
