import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { className, title, description, icon, action, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn('ds-empty-state', className)} {...props}>
      {icon ? <div className="ds-empty-state__icon">{icon}</div> : null}
      <p className="ds-empty-state__title">{title}</p>
      {description ? <p className="ds-empty-state__description">{description}</p> : null}
      {action ? <div className="ds-empty-state__action">{action}</div> : null}
    </div>
  );
});
