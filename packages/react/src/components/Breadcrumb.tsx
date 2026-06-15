import type { HTMLAttributes, LiHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../lib/cn';

export type BreadcrumbProps = HTMLAttributes<HTMLElement>;

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(function Breadcrumb(
  { className, ...props },
  ref,
) {
  return (
    <nav ref={ref} aria-label="Breadcrumb" className={cn('ds-breadcrumb', className)} {...props} />
  );
});

export type BreadcrumbListProps = HTMLAttributes<HTMLOListElement>;

export const BreadcrumbList = forwardRef<HTMLOListElement, BreadcrumbListProps>(
  function BreadcrumbList({ className, ...props }, ref) {
    return <ol ref={ref} className={cn('ds-breadcrumb__list', className)} {...props} />;
  },
);

export type BreadcrumbItemProps = LiHTMLAttributes<HTMLLIElement>;

export const BreadcrumbItem = forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  function BreadcrumbItem({ className, ...props }, ref) {
    return <li ref={ref} className={cn('ds-breadcrumb__item', className)} {...props} />;
  },
);

export type BreadcrumbLinkProps = HTMLAttributes<HTMLSpanElement> & {
  href?: string;
  current?: boolean;
};

export function BreadcrumbLink({
  className,
  current,
  children,
  href = '#',
  ...props
}: BreadcrumbLinkProps) {
  if (current) {
    return (
      <span
        className={cn('ds-breadcrumb__link', 'ds-breadcrumb__link--current', className)}
        aria-current="page"
        {...props}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      className={cn('ds-breadcrumb__link', className)}
      {...(props as HTMLAttributes<HTMLAnchorElement>)}
    >
      {children}
    </a>
  );
}

export type BreadcrumbSeparatorProps = HTMLAttributes<HTMLSpanElement>;

export function BreadcrumbSeparator({
  className,
  children = '/',
  ...props
}: BreadcrumbSeparatorProps) {
  return (
    <span className={cn('ds-breadcrumb__separator', className)} aria-hidden="true" {...props}>
      {children}
    </span>
  );
}
