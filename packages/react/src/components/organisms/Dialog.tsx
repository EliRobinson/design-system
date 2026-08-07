import type { HTMLAttributes, ReactNode } from 'react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '../../lib/cn';

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const DialogContext = createContext<DialogContextValue | null>(null);

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

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const titleId = 'ds-dialog-title';
  const descriptionId = 'ds-dialog-description';
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

  return (
    <DialogContext.Provider
      value={{ open, onOpenChange: handleOpenChange, titleId, descriptionId }}
    >
      {children}
    </DialogContext.Provider>
  );
}

export type DialogTriggerProps = HTMLAttributes<HTMLButtonElement>;

export function DialogTrigger({ className, onClick, children, ...props }: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext();

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        onOpenChange(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export type DialogContentProps = HTMLAttributes<HTMLDialogElement>;

export const DialogContent = forwardRef<HTMLDialogElement, DialogContentProps>(
  function DialogContent({ className, children, ...props }, ref) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const { open, onOpenChange, titleId, descriptionId } = useDialogContext();

    const setRefs = useCallback(
      (node: HTMLDialogElement | null) => {
        dialogRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

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
        className={cn('ds-dialog', className)}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => onOpenChange(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            onOpenChange(false);
          }
        }}
        {...props}
      >
        <div className="ds-dialog__inner">{children}</div>
      </dialog>
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

export type DialogCloseProps = HTMLAttributes<HTMLButtonElement>;

export function DialogClose({ className, onClick, children, ...props }: DialogCloseProps) {
  const { onOpenChange } = useDialogContext();

  return (
    <button
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
}
