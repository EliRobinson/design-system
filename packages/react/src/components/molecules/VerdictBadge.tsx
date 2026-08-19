import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type Verdict = 'go' | 'no' | 'hold';

/* Marks, not copy. A verdict that signalled by fill alone would be SC 1.4.1
   (Use of Color), so the badge always draws a shape as well as a word — and a
   shape with no words in it is not a string the product has to own. `glyph`
   overrides these; `label` is the product's. */
const DEFAULT_GLYPH: Record<Verdict, string> = {
  go: '✓',
  no: '✕',
  hold: '◑',
};

export type VerdictBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  verdict: Verdict;
  label: string;
  glyph?: ReactNode;
};

/** A decision marker that states its verdict as a glyph and a word, never by colour alone. */
export const VerdictBadge = forwardRef<HTMLSpanElement, VerdictBadgeProps>(function VerdictBadge(
  { className, verdict, label, glyph, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn('ds-verdict', `ds-verdict--${verdict}`, className)} {...props}>
      {/* The glyph is aria-hidden on purpose. ✓ / ✕ / ◑ are punctuation-class
          characters: a screen reader may skip them silently or read them as
          something unhelpful, and that varies by reader and by verbosity
          setting. So the glyph is the sighted channel only, and `label` — the
          word — is the accessible text. The meaning never depends on a
          character a screen reader may drop. */}
      <span className="ds-verdict__glyph" aria-hidden="true">
        {glyph ?? DEFAULT_GLYPH[verdict]}
      </span>
      <span className="ds-verdict__word">{label}</span>
    </span>
  );
});
