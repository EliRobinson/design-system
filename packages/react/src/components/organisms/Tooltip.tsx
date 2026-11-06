import type { HTMLAttributes, ReactNode, RefObject } from 'react';
import { createContext, forwardRef, useContext, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AnchoredSide } from '../../hooks/useAnchoredPosition.js';
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition.js';
import { useEscapeKey } from '../../hooks/useEscapeKey.js';
import { useHasMounted } from '../../hooks/useHasMounted.js';
import { cn } from '../../lib/cn.js';
import { useMergedRef } from '../../lib/useMergedRef.js';

type TooltipContextValue = {
  open: boolean;
  labelOnly: boolean;
  setHovered: (hovered: boolean) => void;
  setFocused: (focused: boolean) => void;
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
  /**
   * Which edge of the trigger the tooltip hangs from. `'left'` and `'right'`
   * suit a narrow vertical rail, where a tooltip below the icon would cover the
   * next row. It flips to the opposite side when there is no room. Default
   * `'bottom'`.
   */
  side?: AnchoredSide;
  /**
   * For a tooltip that only repeats the trigger's own accessible name, such as
   * an icon-only button's label. The trigger gets no `aria-describedby` and the
   * content is `aria-hidden`, so a screen reader says the name once, not twice.
   * Default `false`.
   */
  labelOnly?: boolean;
};

export function Tooltip({ children, side = 'bottom', labelOnly = false }: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /* Hover and focus are tracked apart, so the pointer leaving does not hide a
     tooltip that keyboard focus still holds open. Escape dismisses it until the
     next time either one starts over (WCAG 1.4.13: dismissible without moving
     the pointer or focus). */
  const [hovered, setHoveredState] = useState(false);
  const [focused, setFocusedState] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;

  // Starting either one over also lifts an Escape dismissal.
  const track = (set: (on: boolean) => void) => (on: boolean) => {
    set(on);
    if (on) setDismissed(false);
  };
  const setHovered = track(setHoveredState);
  const setFocused = track(setFocusedState);

  useEscapeKey(() => setDismissed(true), open);

  // Same anchoring as Popover and DropdownMenu, so a tooltip follows its
  // trigger through a scroll or a resize instead of being measured once during
  // render and left behind. It is centred rather than left-aligned, and it
  // rides above the other overlays.
  useAnchoredPosition(open, triggerRef, contentRef, {
    side,
    align: 'center',
    zIndex: 'var(--z-tooltip)',
  });

  return (
    <TooltipContext.Provider
      value={{ open, labelOnly, setHovered, setFocused, triggerRef, contentRef, tooltipId }}
    >
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
    const { labelOnly, setHovered, setFocused, triggerRef, tooltipId } = useTooltipContext();
    const setRefs = useMergedRef<HTMLSpanElement>(triggerRef, ref);

    return (
      <span
        ref={setRefs}
        className={cn('ds-tooltip__trigger', className)}
        aria-describedby={labelOnly ? undefined : tooltipId}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          setHovered(true);
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          setHovered(false);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          setFocused(true);
        }}
        onBlur={(event) => {
          onBlur?.(event);
          setFocused(false);
        }}
        {...props}
      />
    );
  },
);

export type TooltipContentProps = HTMLAttributes<HTMLDivElement>;

export function TooltipContent({ className, children, ...props }: TooltipContentProps) {
  const { open, labelOnly, contentRef, tooltipId } = useTooltipContext();
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
      aria-hidden={labelOnly ? true : undefined}
      className={cn('ds-tooltip__content', className)}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}
