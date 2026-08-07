import type { HTMLAttributes, ReactNode } from 'react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../lib/cn';

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export type ToastData = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toasts: ToastData[];
  toast: (data: Omit<ToastData, 'id'>) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within Toaster');
  }
  return context;
}

export type ToasterProps = {
  children?: ReactNode;
};

export function Toaster({ children }: ToasterProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // The viewport portals into `document.body`, which does not exist while the
  // app is server-rendered. Gating on a mount flag keeps `Toaster` renderable
  // from a server component tree — without it, wrapping an app in `Toaster`
  // throws `document is not defined` on any Next.js/Remix build, and the
  // `useToast` context makes mounting it client-only impossible for consumers.
  // The server and first client render agree (no viewport), so hydration is
  // clean; toasts can only exist after an interaction anyway.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (data: Omit<ToastData, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const duration = data.duration ?? 5000;

      setToasts((current) => [...current, { ...data, id }]);

      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div className="ds-toast-viewport" aria-live="polite" aria-relevant="additions">
              {toasts.map((item) => (
                <Toast key={item.id} variant={item.variant} onDismiss={() => dismiss(item.id)}>
                  {item.title ? <ToastTitle>{item.title}</ToastTitle> : null}
                  {item.description ? (
                    <ToastDescription>{item.description}</ToastDescription>
                  ) : null}
                </Toast>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useToastContext();
}

export type ToastProps = HTMLAttributes<HTMLDivElement> & {
  variant?: ToastVariant;
  onDismiss?: () => void;
};

export function Toast({
  className,
  variant = 'default',
  onDismiss,
  children,
  ...props
}: ToastProps) {
  return (
    <div role="status" className={cn('ds-toast', `ds-toast--${variant}`, className)} {...props}>
      <div className="ds-toast__content">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          className="ds-toast__close"
          aria-label="Dismiss notification"
          onClick={onDismiss}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export type ToastTitleProps = HTMLAttributes<HTMLDivElement>;

export function ToastTitle({ className, ...props }: ToastTitleProps) {
  return <div className={cn('ds-toast__title', className)} {...props} />;
}

export type ToastDescriptionProps = HTMLAttributes<HTMLDivElement>;

export function ToastDescription({ className, ...props }: ToastDescriptionProps) {
  return <div className={cn('ds-toast__description', className)} {...props} />;
}

export type ToastActionProps = HTMLAttributes<HTMLButtonElement>;

export const ToastAction = forwardRef<HTMLButtonElement, ToastActionProps>(function ToastAction(
  { className, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" className={cn('ds-toast__action', className)} {...props} />
  );
});
