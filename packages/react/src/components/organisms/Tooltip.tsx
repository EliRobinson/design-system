import type { HTMLAttributes, ReactNode, RefObject } from 'react';
import { createContext, forwardRef, useContext, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPosition } from '../../hooks/useAnchoredPosition.js';
import { useHasMounted } from '../../hooks/useHasMounted.js';
import { cn } from '../../lib/cn.js';
import { useMergedRef } from '../../lib/useMergedRef.js';

type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLSpanElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  tooltipId: string;
};

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltipContext() {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error('Tooltip compound components must be used within Tooltip');
  }
  return context;
}

export type TooltipProps = {
  children: ReactNode;
  delayDuration?: number;
};

export function Tooltip({ children }: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Same anchoring as Popover and DropdownMenu, so a tooltip follows its
  // trigger through a scroll or a resize instead of being measured once during
  // render and left behind. It is centred rather than left-aligned, and it
  // rides above the other overlays.
  useAnchoredPosition(open, triggerRef, contentRef, {
    align: 'center',
    zIndex: 'var(--z-tooltip)',
  });

  return (
    <TooltipContext.Provider value={{ open, setOpen, triggerRef, contentRef, tooltipId }}>
      {children}
    </TooltipContext.Provider>
  );
}

export type TooltipTriggerProps = HTMLAttributes<HTMLSpanElement>;

export const TooltipTrigger = forwardRef<HTMLSpanElement, TooltipTriggerProps>(
  function TooltipTrigger(
    { className, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props },
    ref,
  ) {
    const { setOpen, triggerRef, tooltipId } = useTooltipContext();
    const setRefs = useMergedRef<HTMLSpanElement>(triggerRef, ref);

    const show = () => setOpen(true);
    const hide = () => setOpen(false);

    return (
      <span
        ref={setRefs}
        className={cn('ds-tooltip__trigger', className)}
        aria-describedby={tooltipId}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          show();
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          hide();
        }}
        onFocus={(event) => {
          onFocus?.(event);
          show();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          hide();
        }}
        {...props}
      />
    );
  },
);

export type TooltipContentProps = HTMLAttributes<HTMLDivElement>;

export function TooltipContent({ className, children, ...props }: TooltipContentProps) {
  const { open, contentRef, tooltipId } = useTooltipContext();
  const hasMounted = useHasMounted();

  // The mount gate its siblings use, rather than the old `!triggerRef.current`
  // check: that guard existed because positioning was read off the trigger
  // during render, and it only kept the portal off the server by accident.
  // `useAnchoredPosition` now measures in a layout effect, so what is left to
  // guard is the portal's `document.body` — which is exactly this.
  if (!open || !hasMounted) {
    return null;
  }

  return createPortal(
    <div
      ref={contentRef}
      id={tooltipId}
      role="tooltip"
      className={cn('ds-tooltip__content', className)}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}
