import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn.js';

export type StubCardItem = { label: string; value: string };

export type StubCardProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  items: StubCardItem[];
  stubLabel: string;
  stubValue: string;
  stubCaption?: string;
  footnote?: string;
};

/** A summary that reads as a ticket stub: a body column beside a perforated stub column. */
export const StubCard = forwardRef<HTMLDivElement, StubCardProps>(function StubCard(
  { className, title, items, stubLabel, stubValue, stubCaption, footnote, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn('ds-stub', className)} {...props}>
      <div className="ds-stub__body">
        <p className="ds-stub__title">{title}</p>
        <dl className="ds-stub__items">
          {items.map((item) => (
            <div className="ds-stub__item" key={item.label}>
              <dt className="ds-stub__label">{item.label}</dt>
              <dd className="ds-stub__value">{item.value}</dd>
            </div>
          ))}
        </dl>
        {footnote ? <p className="ds-stub__footnote">{footnote}</p> : null}
      </div>
      <div className="ds-stub__stub">
        <p className="ds-stub__stub-label">{stubLabel}</p>
        <p className="ds-stub__stub-value">{stubValue}</p>
        {stubCaption ? <p className="ds-stub__stub-caption">{stubCaption}</p> : null}
      </div>
    </div>
  );
});
