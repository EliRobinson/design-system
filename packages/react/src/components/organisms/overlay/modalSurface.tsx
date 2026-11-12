import type { ButtonHTMLAttributes, HTMLAttributes, RefObject } from 'react';
import { forwardRef, useCallback, useEffect, useId, useMemo, useRef } from 'react';

import type { UseDisclosureOptions } from '../../../hooks/useDisclosure.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import { EscapeLayerProvider, useNativeEscapeLayer } from '../../../hooks/useEscapeKey.js';
import { cn } from '../../../lib/cn.js';
import { useMergedRef } from '../../../lib/useMergedRef.js';

/* Internal. The parts `Dialog` and `Sheet` are both made of.
 *
 * The two components are the same modal surface with a different block class
 * and, for Sheet, an edge to sit against: a native <dialog> driven by
 * controlled-or-uncontrolled open state, labelled by whatever title its own
 * compound parts render. Everything that is genuinely shared lives here; each
 * component keeps its own context, its own exported names, and its own
 * class names. */

export type ModalSurfaceContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

export type ModalSurfaceOptions = UseDisclosureOptions;

/**
 * Builds the context value a modal surface publishes to its compound parts.
 *
 * The ids come from `useId`, so two of these on one page never collide — an
 * `aria-labelledby` that resolves to a different component's title is a
 * silently wrong accessible name, not a visible bug.
 */
export function useModalSurface({
  open,
  defaultOpen,
  onOpenChange,
}: ModalSurfaceOptions): ModalSurfaceContextValue {
  const id = useId();
  const disclosure = useDisclosure({ open, defaultOpen, onOpenChange });

  return useMemo(
    () => ({
      open: disclosure.open,
      onOpenChange: disclosure.setOpen,
      titleId: `${id}-title`,
      descriptionId: `${id}-description`,
    }),
    [disclosure.open, disclosure.setOpen, id],
  );
}

export type ModalSurfaceProps = HTMLAttributes<HTMLDialogElement> & {
  context: ModalSurfaceContextValue;
  /** Class for the scroll container the children are wrapped in. */
  innerClassName: string;
};

/**
 * Gives focus back to the opener when an open <dialog> is unmounted.
 *
 * `close()` returns focus natively, but a <dialog> that is removed while open
 * (a consumer rendering it conditionally) never closes. Call the returned
 * function just before `showModal()`. It runs in this component's effect,
 * before any parent effect, so a parent that moves focus on open
 * (CommandPalette's input) has not done it yet.
 */
function useFocusReturnOnUnmount(dialogRef: RefObject<HTMLDialogElement | null>) {
  const openerRef = useRef<HTMLElement | SVGElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      const opener = openerRef.current;
      // Removal keeps the `open` attribute, so `dialog.open` still says
      // whether it was showing. StrictMode's simulated unmount (dev only)
      // leaves the node in the document, which is how a real unmount is told
      // apart from it.
      if (!dialog?.open || dialog.isConnected || !opener) {
        return;
      }
      // Only step in when focus went down with the dialog: the browser moves
      // it to <body>. Focus that something else took on purpose stays put.
      const active = document.activeElement;
      if (!active || active === document.body) {
        opener.focus();
      }
    };
  }, [dialogRef]);

  return useCallback(() => {
    const active = document.activeElement;
    openerRef.current =
      active instanceof HTMLElement || active instanceof SVGElement ? active : null;
  }, []);
}

/**
 * The <dialog> element itself. Native <dialog> owns modality, the backdrop,
 * the focus trap, and Escape; React only mirrors `open` onto
 * `showModal()`/`close()` and reports the native close back up.
 */
export const ModalSurface = forwardRef<HTMLDialogElement, ModalSurfaceProps>(function ModalSurface(
  { context, innerClassName, className, children, ...props },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const setRefs = useMergedRef<HTMLDialogElement>(dialogRef, ref);
  const { open, onOpenChange, titleId, descriptionId } = context;
  const captureOpener = useFocusReturnOnUnmount(dialogRef);
  // The browser closes a modal <dialog> on Escape itself. Holding a place on
  // the stack stops a layer opened before it, now underneath, from closing on
  // the same keypress, and lets a layer opened inside it cancel the keydown
  // so the dialog stays open.
  const escapeLayer = useNativeEscapeLayer(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      captureOpener();
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, captureOpener]);

  return (
    <dialog
      ref={setRefs}
      className={className}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        // A click anywhere over the ::backdrop targets the <dialog> itself,
        // because the backdrop is the dialog's own pseudo-element. The box
        // does NOT fill the viewport -- `.ds-dialog` is a centred panel capped
        // at 480px -- so "target === the element rather than its inner panel"
        // is the whole test; there is no geometry to compare.
        //
        // The same top-layer hit-testing is why a control *behind* an open
        // modal is unreachable: elementFromPoint over the backdrop returns
        // this <dialog>, never the occluded control.
        if (event.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
      {...props}
    >
      <div className={innerClassName}>
        <EscapeLayerProvider value={escapeLayer}>{children}</EscapeLayerProvider>
      </div>
    </dialog>
  );
});

export type ModalTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  onOpenChange: (open: boolean) => void;
};

/**
 * Unstyled button that opens the surface.
 *
 * The ref is forwarded straight to the <button>: this owns that node outright
 * and holds no second reference to it, so there is nothing to merge.
 *
 * `type="button"` sits before the spread, so it is a default a consumer can
 * override rather than a pin — same as `DropdownMenuItem` and
 * `AnchoredOverlayTrigger`. A trigger inside a <form> that should also submit
 * is a real case, and `ButtonHTMLAttributes` advertises `type`; accepting the
 * prop and then discarding it would be the worse of the two behaviours.
 */
export const ModalTrigger = forwardRef<HTMLButtonElement, ModalTriggerProps>(function ModalTrigger(
  { onOpenChange, onClick, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
});

export type ModalCloseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  onOpenChange: (open: boolean) => void;
};

/** Secondary-styled button that closes the surface. See `ModalTrigger` on the
 * forwarded ref and on why `type` stays overridable. */
export const ModalClose = forwardRef<HTMLButtonElement, ModalCloseProps>(function ModalClose(
  { onOpenChange, className, onClick, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn('ds-button ds-button--secondary', className)}
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(false);
      }}
      {...props}
    >
      {children ?? 'Close'}
    </button>
  );
});
