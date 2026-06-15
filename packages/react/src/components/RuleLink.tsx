import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '../lib/cn';

export type RuleLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
};

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export const RuleLink = forwardRef<HTMLAnchorElement, RuleLinkProps>(function RuleLink(
  { className, children, ...props },
  ref,
) {
  return (
    <a ref={ref} className={cn('ds-rule-link', className)} {...props}>
      {children}
      <ArrowIcon />
    </a>
  );
});
