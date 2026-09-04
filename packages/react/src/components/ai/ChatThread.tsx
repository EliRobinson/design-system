import type { HTMLAttributes } from 'react';
import { forwardRef, useLayoutEffect, useRef } from 'react';

import { cn } from '../../lib/cn.js';
import { useMergedRef } from '../../lib/useMergedRef.js';

/**
 * How close to the bottom, in CSS pixels, still counts as reading the newest
 * turn. Inside it a new turn is scrolled into view; outside it the reader is
 * looking at something older and is left exactly where they are.
 *
 * A constant, not a token and not a prop. A token would say designers tune it,
 * and there is nothing here to tune — it measures no gap, ramp or step, and it
 * never reaches a stylesheet. A prop would be API surface nobody asked for, in
 * the same place a caller who genuinely wants to own scrolling already has
 * `followNewMessages={false}` and the forwarded ref.
 *
 * 32 is bounded on both sides, which is the only reason it is 32:
 *
 * - **Below.** `scrollHeight - scrollTop - clientHeight` is rarely exactly `0`
 *   at the bottom. Browsers report fractional scroll offsets under page zoom
 *   and on non-integer device pixel ratios, so an exact test would quietly stop
 *   following on a zoomed page. A few pixels of slack is not optional.
 * - **Above.** A turn is at least an avatar tall (40px, from `ds-avatar--md`)
 *   and turns are `--space-5` (20px) apart, so scrolling back past even one
 *   turn moves ~60px. 32 clears every rounding error and no deliberate scroll.
 */
const PINNED_TO_BOTTOM_THRESHOLD_PX = 32;

export type ChatThreadProps = HTMLAttributes<HTMLDivElement> & {
  /** Accessible name for the log region. Required — no copy lives in the component. */
  label: string;
  /** Default true. False opts a closed or replayed thread out of live announcement. */
  announce?: boolean;
  /**
   * Keep the newest turn in view as the thread grows. Default true.
   *
   * Only a reader already at the bottom is followed — scroll up to re-read an
   * earlier turn and the thread stays put until you return. The scroll is
   * instant, never animated, and moves nothing in the focus order, so a
   * composer keeps the caret while turns arrive behind it.
   */
  followNewMessages?: boolean;
};

/**
 * A scrolling conversation region that announces new turns to assistive technology.
 *
 * @deprecated Use `Conversation` from `@elirobinson/ai-elements/components/conversation`.
 *
 * `use-stick-to-bottom`, which backs it, already implements the one behaviour
 * this component was written for: follow the newest turn only for a reader who
 * is already at the bottom. Its smooth-scroll default was the gap, and the
 * transform layer now pins it to `instant` — see
 * `scripts/ai-elements-patches/a11y.mjs`, `conversation-initial-instant`.
 *
 * The one thing that does not carry over is the `announce` prop. `Conversation`
 * spreads `{...props}` last over its `role="log"`, so write the attributes
 * directly: `<Conversation aria-live="polite" aria-relevant="additions text">`,
 * or `aria-live="off"` for a closed or replayed thread.
 *
 * Published and in use, so this is a deprecation and not a removal. It goes on
 * the next major.
 */
export const ChatThread = forwardRef<HTMLDivElement, ChatThreadProps>(function ChatThread(
  { className, label, announce = true, followNewMessages = true, children, ...props },
  ref,
) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useMergedRef<HTMLDivElement>(threadRef, ref);

  // The scroll height as of the last commit. Following needs to know where the
  // reader was *before* the new turn existed, and by the time a layout effect
  // runs the turn is already in the DOM — measuring then reports the reader as
  // one whole turn away from the bottom and the thread stops following exactly
  // when the turn is tall enough to matter. `scrollTop` and `clientHeight` are
  // untouched by appending to the end, so last commit's `scrollHeight` is the
  // one missing term, and remembering it reconstructs the earlier measurement
  // exactly rather than approximating it.
  const lastScrollHeightRef = useRef(0);

  useLayoutEffect(() => {
    const element = threadRef.current;

    if (!element) {
      return;
    }

    const previousScrollHeight = lastScrollHeightRef.current;

    // Recorded even when following is off, so turning it back on mid-thread
    // measures against this commit rather than against whenever it was last on.
    lastScrollHeightRef.current = element.scrollHeight;

    if (!followNewMessages) {
      return;
    }

    // Nothing arrived. A re-render that changes no heights must not nudge a
    // reader who is sitting a few pixels short of the bottom.
    if (element.scrollHeight <= previousScrollHeight) {
      return;
    }

    const distanceFromBottom = previousScrollHeight - element.scrollTop - element.clientHeight;

    if (distanceFromBottom > PINNED_TO_BOTTOM_THRESHOLD_PX) {
      return;
    }

    // Assignment, not `scrollTo({ behavior: 'smooth' })`. An instant jump has
    // no motion to reduce, so this sidesteps `prefers-reduced-motion` rather
    // than taking on the care an animation in a live region would need.
    element.scrollTop = element.scrollHeight;
  }, [children, followNewMessages]);

  return (
    <div
      ref={setRefs}
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
