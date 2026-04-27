import type { HTMLAttributes } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', ...props }: CardProps) {
  const mergedClassName = `ds-card ${className}`.trim();

  return <div className={mergedClassName} {...props} />;
}
