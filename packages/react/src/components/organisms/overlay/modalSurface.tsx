import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { forwardRef, useEffect, useId, useMemo, useRef } from 'react';

import type { UseDisclosureOptions } from '../../../hooks/useDisclosure';
import { useDisclosure } from '../../../hooks/useDisclosure';
import { cn } from '../../../lib/cn';
import { useMergedRef } from '../../../lib/useMergedRef';

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={setRefs}
      className={className}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        // The <dialog> box fills the viewport; a click that lands on the
        // element itself rather than on its inner panel is a backdrop click.
        if (event.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
      {...props}
    >
      <div className={innerClassName}>{children}</div>
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
