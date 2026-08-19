import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type StreamingCaretProps = HTMLAttributes<HTMLSpanElement> & {
  /** Default true. False renders nothing at all, so it cannot outlive the stream. */
  active?: boolean;
  /** Accessible name. Present promotes the caret to role="status"; absent hides it. */
  label?: string;
};

/** A blinking caret marking the message an assistant is still writing. */
export const StreamingCaret = forwardRef<HTMLSpanElement, StreamingCaretProps>(
  function StreamingCaret({ className, active = true, label, ...props }, ref) {
    if (!active) return null;

    return (
      <span
        ref={ref}
        className={cn('ds-streaming-caret', className)}
        {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
        {...props}
      />
    );
  },
);
