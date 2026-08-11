import type { HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useContext } from 'react';

import { cn } from '../../lib/cn';
import type { ModalSurfaceContextValue } from './overlay/modalSurface';
import { ModalClose, ModalSurface, ModalTrigger, useModalSurface } from './overlay/modalSurface';

type SheetSide = 'left' | 'right' | 'top' | 'bottom';

// `side` is deliberately not on the context: `SheetContent` takes it as a prop
// and is the only thing that renders anything positional, so a second copy on
// the context could only ever disagree with it.
const SheetContext = createContext<ModalSurfaceContextValue | null>(null);

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

export function Sheet({ open, defaultOpen = false, onOpenChange, children }: SheetProps) {
  const context = useModalSurface({ open, defaultOpen, onOpenChange });

  return <SheetContext.Provider value={context}>{children}</SheetContext.Provider>;
}

export type SheetTriggerProps = HTMLAttributes<HTMLButtonElement>;

export function SheetTrigger(props: SheetTriggerProps) {
  const { onOpenChange } = useSheetContext();
  return <ModalTrigger onOpenChange={onOpenChange} {...props} />;
}

export type SheetContentProps = HTMLAttributes<HTMLDialogElement> & {
  side?: SheetSide;
};

export const SheetContent = forwardRef<HTMLDialogElement, SheetContentProps>(function SheetContent(
  { className, side = 'right', ...props },
  ref,
) {
  const context = useSheetContext();

  return (
    <ModalSurface
      ref={ref}
      context={context}
      className={cn('ds-sheet', `ds-sheet--${side}`, className)}
      innerClassName="ds-sheet__inner"
      {...props}
    />
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

export function SheetClose(props: SheetCloseProps) {
  const { onOpenChange } = useSheetContext();
  return <ModalClose onOpenChange={onOpenChange} {...props} />;
}
