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

type SheetSide = 'left' | 'right' | 'top' | 'bottom';

type SheetContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  side: SheetSide;
};

const SheetContext = createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const context = useContext(SheetContext);
  if (!context) {
    throw new Error('Sheet compound components must be used within Sheet');
  }
  return context;
}

export type SheetProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const titleId = 'ds-sheet-title';
  const descriptionId = 'ds-sheet-description';
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
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
    <SheetContext.Provider
      value={{ open, onOpenChange: handleOpenChange, titleId, descriptionId, side: 'right' }}
    >
      {children}
    </SheetContext.Provider>
  );
}

export type SheetTriggerProps = HTMLAttributes<HTMLButtonElement>;

export function SheetTrigger({ className, onClick, children, ...props }: SheetTriggerProps) {
  const { onOpenChange } = useSheetContext();

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

export type SheetContentProps = HTMLAttributes<HTMLDialogElement> & {
  side?: SheetSide;
};

export const SheetContent = forwardRef<HTMLDialogElement, SheetContentProps>(function SheetContent(
  { className, side = 'right', children, ...props },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { open, onOpenChange, titleId, descriptionId } = useSheetContext();

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
      className={cn('ds-sheet', `ds-sheet--${side}`, className)}
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
      <div className="ds-sheet__inner">{children}</div>
    </dialog>
  );
});

export type SheetHeaderProps = HTMLAttributes<HTMLDivElement>;

export function SheetHeader({ className, ...props }: SheetHeaderProps) {
  return <div className={cn('ds-sheet__header', className)} {...props} />;
}

export type SheetTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function SheetTitle({ className, ...props }: SheetTitleProps) {
  const { titleId } = useSheetContext();
  return <h2 id={titleId} className={cn('ds-sheet__title', className)} {...props} />;
}

export type SheetDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function SheetDescription({ className, ...props }: SheetDescriptionProps) {
  const { descriptionId } = useSheetContext();
  return <p id={descriptionId} className={cn('ds-sheet__description', className)} {...props} />;
}

export type SheetFooterProps = HTMLAttributes<HTMLDivElement>;

export function SheetFooter({ className, ...props }: SheetFooterProps) {
  return <div className={cn('ds-sheet__footer', className)} {...props} />;
}

export type SheetCloseProps = HTMLAttributes<HTMLButtonElement>;

export function SheetClose({ className, onClick, children, ...props }: SheetCloseProps) {
  const { onOpenChange } = useSheetContext();

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
