import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
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
    <AccordionContext.Provider value={{ openValues, toggle, baseId, headingLevel }}>
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

export type AccordionTriggerProps = ButtonHTMLAttributes<HTMLButtonElement>;

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
  function AccordionTrigger({ className, children, ...props }, ref) {
    const { openValues, toggle, baseId, headingLevel } = useAccordionContext();
    const { value } = useAccordionItemContext();
    const isOpen = openValues.includes(value);
    const HeadingTag = HEADING_TAGS[headingLevel];

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
          onClick={() => toggle(value)}
          {...props}
        >
          {children}
        </button>
      </HeadingTag>
    );
  },
);

export type AccordionContentProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'>;

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
