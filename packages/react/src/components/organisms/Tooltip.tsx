import type { HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useCallback, useContext, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/cn';

type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
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
  const triggerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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

    const setRefs = useCallback(
      (node: HTMLSpanElement | null) => {
        triggerRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref, triggerRef],
    );

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
  const { open, triggerRef, contentRef, tooltipId } = useTooltipContext();

  if (!open || !triggerRef.current) {
    return null;
  }

  const rect = triggerRef.current.getBoundingClientRect();

  return createPortal(
    <div
      ref={contentRef}
      id={tooltipId}
      role="tooltip"
      className={cn('ds-tooltip__content', className)}
      style={{
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-tooltip)',
      }}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}
