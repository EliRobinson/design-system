import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';
import type { Verdict } from './VerdictBadge.js';
import { VerdictBadge } from './VerdictBadge.js';

export type DecisionFigure = { label: string; value: string; kind?: string };

export type DecisionCardHeadingLevel = 2 | 3 | 4 | 5 | 6;

const HEADING_TAGS = {
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<DecisionCardHeadingLevel, string>;

const DEFAULT_HEADING_LEVEL: DecisionCardHeadingLevel = 2;

// Same normalization Accordion does, and for the same reason: `headingLevel`
// is typed 2-6, but this is a published library, and a consumer outside the
// type boundary (plain JS, `as any`, a CMS-driven prop) can hand it any number
// at runtime. `HEADING_TAGS[headingLevel]` on an out-of-range value resolves to
// `undefined`, which React throws on hard ("Element type is invalid... got:
// undefined") -- taking down the whole tree, not just the card.
//
// `1` is deliberately out of range here where Accordion allows it. An accordion
// can be the only thing on a page; a DecisionCard is a card, and a card that
// claims the document's <h1> is claiming to be the page. 2 is the floor and the
// default, which is also what the card's type ramp is drawn for.
function resolveHeadingLevel(level: DecisionCardHeadingLevel): DecisionCardHeadingLevel {
  return level in HEADING_TAGS ? level : DEFAULT_HEADING_LEVEL;
}

export type DecisionCardProps = HTMLAttributes<HTMLDivElement> & {
  verdict: Verdict;
  verdictLabel: string;
  headline: string;
  /**
   * Heading level (2-6) for `headline`, which renders as the real heading
   * element rather than a styled paragraph. There is no single correct level
   * for an arbitrary document outline, so this is exposed rather than
   * hardcoded — a card sitting under a page `<h1>` leaves the default
   * (`headingLevel={2}`), one inside an `<h2>` section passes
   * `headingLevel={3}`. Defaults to 2.
   */
  headingLevel?: DecisionCardHeadingLevel;
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
    headingLevel = DEFAULT_HEADING_LEVEL,
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
  const HeadingTag = HEADING_TAGS[resolveHeadingLevel(headingLevel)];

  return (
    <div ref={ref} className={cn('ds-decision', className)} {...props}>
      <div className="ds-decision__head">
        <VerdictBadge verdict={verdict} label={verdictLabel} />
        {subject ? <p className="ds-decision__subject">{subject}</p> : null}
      </div>

      <div className="ds-decision__body">
        {/* A real heading element, not a styled <p> and not a <div
            role="heading">. The headline is the card's title in the document
            outline, so it has to be reachable by a screen reader's heading
            navigation — which is the whole reason `headingLevel` exists. The
            type ramp is carried by the class, so every level looks identical
            and only the outline changes. */}
        <HeadingTag className="ds-decision__headline">{headline}</HeadingTag>

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
