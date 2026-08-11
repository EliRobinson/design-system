import type { ButtonHTMLAttributes, HTMLAttributes, RefObject } from 'react';
import { forwardRef, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useAnchoredPosition } from '../../../hooks/useAnchoredPosition';
import { useClickOutside } from '../../../hooks/useClickOutside';
import type { UseDisclosureOptions } from '../../../hooks/useDisclosure';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { useEscapeKey } from '../../../hooks/useEscapeKey';
import { useHasMounted } from '../../../hooks/useHasMounted';
import { useMergedRef } from '../../../lib/useMergedRef';

/* Internal. The parts `Popover` and `DropdownMenu` are both made of.
 *
 * Both are a button that toggles a portalled panel anchored under it, dismissed
 * by Escape or a click outside the pair. What differs is the panel's role and
 * class names, and DropdownMenu's roving `activeIndex` — those stay in the
 * components. */

export type AnchoredOverlayContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  contentId: string;
};

export type AnchoredOverlayOptions = UseDisclosureOptions;

/**
 * Open state, the trigger/content refs, and the three behaviours every
 * anchored overlay needs: position against the trigger, dismiss on Escape,
 * dismiss on a click outside both nodes.
 */
export function useAnchoredOverlay({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
}: AnchoredOverlayOptions): AnchoredOverlayContextValue {
  const contentId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasMounted = useHasMounted();
  const { open, setOpen } = useDisclosure({ open: controlledOpen, defaultOpen, onOpenChange });

  // Gated on the same mount flag the portal is, because an overlay that starts
  // open has no content node on the first render — positioning it then measures
  // nothing, and without this the panel would stay unpositioned until the next
  // scroll or resize.
  useAnchoredPosition(open && hasMounted, triggerRef, contentRef);
  useClickOutside([triggerRef, contentRef], () => setOpen(false), open);
  useEscapeKey(() => setOpen(false), open);

  return useMemo(
    () => ({ open, onOpenChange: setOpen, triggerRef, contentRef, contentId }),
    [open, setOpen, contentId],
  );
}

export type AnchoredOverlayTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  overlay: AnchoredOverlayContextValue;
};

/** The toggle button, wired to `aria-expanded`/`aria-controls` and the anchor ref. */
export const AnchoredOverlayTrigger = forwardRef<HTMLButtonElement, AnchoredOverlayTriggerProps>(
  function AnchoredOverlayTrigger({ overlay, onClick, children, ...props }, ref) {
    const { open, onOpenChange, triggerRef, contentId } = overlay;
    const setRefs = useMergedRef<HTMLButtonElement>(triggerRef, ref);

    return (
      <button
        ref={setRefs}
        type="button"
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

export type AnchoredOverlayContentProps = HTMLAttributes<HTMLDivElement> & {
  overlay: AnchoredOverlayContextValue;
};

/** The portalled panel. */
export function AnchoredOverlayContent({
  overlay,
  children,
  ...props
}: AnchoredOverlayContentProps) {
  const hasMounted = useHasMounted();

  // A closed overlay never reaches the portal, so an uncontrolled one survives
  // a server render on its own. One opened via the `open` prop does not —
  // hence the mount gate.
  if (!overlay.open || !hasMounted) {
    return null;
  }

  return createPortal(
    <div ref={overlay.contentRef} id={overlay.contentId} {...props}>
      {children}
    </div>,
    document.body,
  );
}
