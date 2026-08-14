import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type AlertVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, variant = 'default', title, children, role = 'alert', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role={role}
      className={cn('ds-alert', `ds-alert--${variant}`, className)}
      {...props}
    >
      {title && <div className="ds-alert__title">{title}</div>}
      {children && <div className="ds-alert__description">{children}</div>}
    </div>
  );
});
