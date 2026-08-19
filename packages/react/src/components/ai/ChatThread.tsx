import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type ChatThreadProps = HTMLAttributes<HTMLDivElement> & {
  /** Accessible name for the log region. Required — no copy lives in the component. */
  label: string;
  /** Default true. False opts a closed or replayed thread out of live announcement. */
  announce?: boolean;
};

/** A scrolling conversation region that announces new turns to assistive technology. */
export const ChatThread = forwardRef<HTMLDivElement, ChatThreadProps>(function ChatThread(
  { className, label, announce = true, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="log"
      aria-label={label}
      aria-live={announce ? 'polite' : 'off'}
      aria-relevant="additions text"
      className={cn('ds-chat-thread', className)}
      {...props}
    >
      {children}
    </div>
  );
});
