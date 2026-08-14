import type { HTMLAttributes, ImgHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  src?: string;
  alt: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { className, src, alt, fallback, size = 'md', ...props },
  ref,
) {
  const initials = fallback ?? alt.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className={cn('ds-avatar', `ds-avatar--${size}`, className)} {...props}>
      {src ? (
        <img className="ds-avatar__image" src={src} alt={alt} />
      ) : (
        <span className="ds-avatar__fallback" aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  );
});

export type AvatarImageProps = ImgHTMLAttributes<HTMLImageElement>;

export const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(function AvatarImage(
  { className, alt = '', ...props },
  ref,
) {
  return <img ref={ref} className={cn('ds-avatar__image', className)} alt={alt} {...props} />;
});

export type AvatarFallbackProps = HTMLAttributes<HTMLSpanElement>;

export const AvatarFallback = forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  function AvatarFallback({ className, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn('ds-avatar__fallback', className)}
        aria-hidden="true"
        {...props}
      />
    );
  },
);
