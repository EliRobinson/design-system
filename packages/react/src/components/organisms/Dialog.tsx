import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useContext } from 'react';

import { cn } from '../../lib/cn';
import type { ModalSurfaceContextValue } from './overlay/modalSurface';
import { ModalClose, ModalSurface, ModalTrigger, useModalSurface } from './overlay/modalSurface';

const DialogContext = createContext<ModalSurfaceContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog compound components must be used within Dialog');
  }
  return context;
}

export type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const context = useModalSurface({ open, defaultOpen, onOpenChange });

  return <DialogContext.Provider value={context}>{children}</DialogContext.Provider>;
}

export type DialogTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
  function DialogTrigger(props, ref) {
    const { onOpenChange } = useDialogContext();
    return <ModalTrigger ref={ref} onOpenChange={onOpenChange} {...props} />;
  },
);

export type DialogContentProps = HTMLAttributes<HTMLDialogElement>;

export const DialogContent = forwardRef<HTMLDialogElement, DialogContentProps>(
  function DialogContent({ className, ...props }, ref) {
    const context = useDialogContext();

    return (
      <ModalSurface
        ref={ref}
        context={context}
        className={cn('ds-dialog', className)}
        innerClassName="ds-dialog__inner"
        {...props}
      />
    );
  },
);

export type DialogHeaderProps = HTMLAttributes<HTMLDivElement>;

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return <div className={cn('ds-dialog__header', className)} {...props} />;
}

export type DialogTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  const { titleId } = useDialogContext();
  return <h2 id={titleId} className={cn('ds-dialog__title', className)} {...props} />;
}

export type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  const { descriptionId } = useDialogContext();
  return <p id={descriptionId} className={cn('ds-dialog__description', className)} {...props} />;
}

export type DialogFooterProps = HTMLAttributes<HTMLDivElement>;

export function DialogFooter({ className, ...props }: DialogFooterProps) {
  return <div className={cn('ds-dialog__footer', className)} {...props} />;
}

export type DialogCloseProps = ButtonHTMLAttributes<HTMLButtonElement>;

export const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(
  function DialogClose(props, ref) {
    const { onOpenChange } = useDialogContext();
    return <ModalClose ref={ref} onOpenChange={onOpenChange} {...props} />;
  },
);
