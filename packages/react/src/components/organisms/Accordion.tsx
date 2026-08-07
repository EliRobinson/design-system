import type { ButtonHTMLAttributes, HTMLAttributes, MouseEventHandler } from 'react';
import { createContext, forwardRef, useContext, useId, useState } from 'react';

import { cn } from '../../lib/cn';

export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const HEADING_TAGS = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<AccordionHeadingLevel, string>;

const DEFAULT_HEADING_LEVEL: AccordionHeadingLevel = 3;

// `headingLevel` is typed as 1-6, but this is a published library: consumers
// outside this repo's type boundary (plain JS, `as any`, a CMS-driven prop)
// can hand it any number at runtime. `HEADING_TAGS[headingLevel]` on an
// out-of-range value resolves to `undefined`, which React throws on hard
// ("Element type is invalid... got: undefined") -- taking down the whole
// tree, not just the accordion. Normalize once, here, so every consumer of
// the context (currently just AccordionTrigger) sees an always-valid level.
function resolveHeadingLevel(level: AccordionHeadingLevel): AccordionHeadingLevel {
  return level in HEADING_TAGS ? level : DEFAULT_HEADING_LEVEL;
}

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

type AccordionContextValue = {
  openValues: string[];
  toggle: (value: string) => void;
  baseId: string;
  headingLevel: AccordionHeadingLevel;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion compound components must be used within Accordion');
  }
  return context;
}

type AccordionItemContextValue = { value: string };

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error('AccordionTrigger/AccordionContent must be used within AccordionItem');
  }
  return context;
}

type AccordionSharedProps = {
  /**
   * Heading level (1-6) that wraps each trigger, per the WAI-ARIA accordion
   * pattern. There is no single correct default for an arbitrary document
   * outline, so this is exposed rather than hardcoded — a consumer nesting
   * an Accordion under an `<h2>` section should pass `headingLevel={3}` (the
   * default) while one nesting it directly under the page `<h1>` should pass
   * `headingLevel={2}`. Defaults to 3, the common case (accordion under a
   * page section heading).
   */
  headingLevel?: AccordionHeadingLevel;
};

export type AccordionProps = HTMLAttributes<HTMLDivElement> &
  AccordionSharedProps &
  (
    | {
        type?: 'single';
        value?: string;
        defaultValue?: string;
        onValueChange?: (value: string) => void;
      }
    | {
        type: 'multiple';
        value?: string[];
        defaultValue?: string[];
        onValueChange?: (value: string[]) => void;
      }
  );

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(function Accordion(
  {
    className,
    type = 'single',
    value,
    defaultValue,
    onValueChange,
    headingLevel = 3,
    children,
    ...props
  },
  ref,
) {
  const baseId = useId();
  const [internalValues, setInternalValues] = useState<string[]>(() => toArray(defaultValue));
  const isControlled = value !== undefined;
  const openValues = isControlled ? toArray(value) : internalValues;
  const safeHeadingLevel = resolveHeadingLevel(headingLevel);

  const toggle = (itemValue: string) => {
    const isOpen = openValues.includes(itemValue);
    const next =
      type === 'multiple'
        ? isOpen
          ? openValues.filter((item) => item !== itemValue)
          : [...openValues, itemValue]
        : isOpen
          ? []
          : [itemValue];

    if (!isControlled) {
      setInternalValues(next);
    }

    if (type === 'multiple') {
      (onValueChange as ((value: string[]) => void) | undefined)?.(next);
    } else {
      (onValueChange as ((value: string) => void) | undefined)?.(next[0] ?? '');
    }
  };

  return (
    <AccordionContext.Provider
      value={{ openValues, toggle, baseId, headingLevel: safeHeadingLevel }}
    >
      <div ref={ref} className={cn('ds-accordion', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
});

export type AccordionItemProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(function AccordionItem(
  { className, value, children, ...props },
  ref,
) {
  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div ref={ref} className={cn('ds-accordion__item', className)} {...props}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
});

// `id`, `aria-expanded`, and `aria-controls` are computed internally and
// wire this trigger to its AccordionContent panel -- AccordionContent's own
// `aria-labelledby` is derived from the same `${baseId}-trigger-${value}`
// id. Omitting them from the props type (rather than merely relying on
// spread order) stops a consumer from silently overriding the id and
// orphaning that reference, or overriding aria-expanded/aria-controls and
// breaking the a11y wiring outright. `onClick` is also omitted from the raw
// button attributes and re-declared below so a consumer-supplied handler is
// composed with the toggle instead of replacing it (see handleClick).
export type AccordionTriggerProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'id' | 'onClick' | 'aria-expanded' | 'aria-controls'
> & {
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

// Arrow-key navigation between headers is intentionally NOT implemented here.
// Per the WAI-ARIA APG, it's optional for accordions (unlike tabs, where it's
// required) because every trigger is already a real, natively focusable
// <button> in the normal tab order -- Tab/Shift+Tab already move between
// headers correctly with zero extra code. Tabs needs arrow-key handling
// because it uses a single roving tab stop (only the active tab is in the
// tab order); accordion triggers have no such roving-tabindex constraint, so
// copying that pattern here would add an ARIA-incompatible interaction
// (arrow keys aren't a documented accordion convention) without fixing
// anything that's actually broken.
export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  function AccordionTrigger({ className, children, onClick, ...props }, ref) {
    const { openValues, toggle, baseId, headingLevel } = useAccordionContext();
    const { value } = useAccordionItemContext();
    const isOpen = openValues.includes(value);
    const HeadingTag = HEADING_TAGS[headingLevel];

    // Compose rather than replace: a consumer-supplied onClick still runs,
    // but it can never prevent the trigger from toggling. A naive `{...props}`
    // spread after a hardcoded `onClick` would instead let a consumer's handler
    // silently replace the toggle.
    const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      toggle(value);
    };

    return (
      <HeadingTag className="ds-accordion__heading">
        <button
          ref={ref}
          type="button"
          id={`${baseId}-trigger-${value}`}
          aria-expanded={isOpen}
          aria-controls={`${baseId}-content-${value}`}
          className={cn(
            'ds-accordion__trigger',
            isOpen && 'ds-accordion__trigger--open',
            className,
          )}
          onClick={handleClick}
          {...props}
        >
          {children}
        </button>
      </HeadingTag>
    );
  },
);

// `id`, `role`, and `aria-labelledby` are all computed internally: `id` and
// `aria-labelledby` wire this panel to its AccordionTrigger (which points at
// this same `${baseId}-content-${value}` id via `aria-controls`), and `role`
// carries the fixed "region" semantics. All three are omitted so a consumer
// can't silently clobber the wiring or the semantics via `{...props}`.
export type AccordionContentProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'id' | 'role' | 'aria-labelledby'
>;

export const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
  function AccordionContent({ className, children, ...props }, ref) {
    const { openValues, baseId } = useAccordionContext();
    const { value } = useAccordionItemContext();
    const isOpen = openValues.includes(value);

    if (!isOpen) {
      return null;
    }

    return (
      <div
        ref={ref}
        id={`${baseId}-content-${value}`}
        role="region"
        aria-labelledby={`${baseId}-trigger-${value}`}
        className={cn('ds-accordion__content', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
