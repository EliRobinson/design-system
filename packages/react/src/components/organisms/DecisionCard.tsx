import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';
import type { Verdict } from '../molecules/VerdictBadge.js';
import { VerdictBadge } from '../molecules/VerdictBadge.js';

export type DecisionFigure = { label: string; value: string; kind?: string };

export type DecisionCardProps = HTMLAttributes<HTMLDivElement> & {
  verdict: Verdict;
  verdictLabel: string;
  headline: string;
  subject?: string;
  figures?: DecisionFigure[];
  total?: { label: string; value: string };
  contrast?: { label: string; value: string };
  caveat?: string;
  closing?: string;
  action?: ReactNode;
};

/** A verdict, the figures behind it, and an action that exists only when the verdict allows one. */
export const DecisionCard = forwardRef<HTMLDivElement, DecisionCardProps>(function DecisionCard(
  {
    className,
    verdict,
    verdictLabel,
    headline,
    subject,
    figures,
    total,
    contrast,
    caveat,
    closing,
    action,
    ...props
  },
  ref,
) {
  return (
    <div ref={ref} className={cn('ds-decision', className)} {...props}>
      <div className="ds-decision__head">
        <VerdictBadge verdict={verdict} label={verdictLabel} />
        {subject ? <p className="ds-decision__subject">{subject}</p> : null}
      </div>

      <div className="ds-decision__body">
        <p className="ds-decision__headline">{headline}</p>

        {figures && figures.length > 0 ? (
          <dl className="ds-decision__figures">
            {figures.map((figure) => (
              <div
                className="ds-decision__figure"
                data-kind={figure.kind}
                key={`${figure.kind ?? ''}:${figure.label}`}
              >
                <dt className="ds-decision__figure-label">{figure.label}</dt>
                <dd className="ds-decision__figure-value">{figure.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {total ? (
          <p className="ds-decision__total">
            <span className="ds-decision__figure-label">{total.label}</span>
            <span className="ds-decision__figure-value">{total.value}</span>
          </p>
        ) : null}

        {contrast ? (
          <p className="ds-decision__contrast">
            <span className="ds-decision__figure-label">{contrast.label}</span>
            <span className="ds-decision__figure-value">{contrast.value}</span>
          </p>
        ) : null}

        {caveat ? <p className="ds-decision__caveat">{caveat}</p> : null}

        {closing ? <p className="ds-decision__closing">{closing}</p> : null}
      </div>

      {/* The footer guarantee. This is a product guarantee, not a style choice:
          when there is no `action`, the card renders no `.ds-decision__foot`
          element at all — not a disabled button, not a hidden one, nothing.
          A disabled or hidden control is still a control that shipped, and one
          CSS override, one stray `disabled={false}`, or one screen reader that
          ignores `hidden` puts a "buy" button on a "do not buy" verdict. The
          only way to be sure that cannot happen is for the element not to
          exist. `closing` renders in the body above instead, so a negative
          verdict still gets its last word without a footer to hang a control
          on. Keep this a ternary returning null — do not "simplify" it into a
          class, a modifier, or an always-rendered slot. */}
      {action ? <div className="ds-decision__foot">{action}</div> : null}
    </div>
  );
});
