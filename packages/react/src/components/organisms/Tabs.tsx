import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent } from 'react';
import { createContext, useContext, useId, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';

type TabsContextValue = {
  activeTab: string;
  setActiveTab: (value: string) => void;
  baseId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be used within Tabs');
  }
  return context;
}

export type TabsProps = HTMLAttributes<HTMLDivElement> & {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({
  className,
  defaultValue,
  value,
  onValueChange,
  children,
  ...props
}: TabsProps) {
  const baseId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId }}>
      <div className={cn('ds-tabs', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = HTMLAttributes<HTMLDivElement>;

/**
 * Triggers are opaque `children`, so the tab stops are read from the DOM rather
 * than a ref array. The query is scoped to this list's own element, which keeps
 * two tablists on one page independent.
 */
const TRIGGER_SELECTOR = '[role="tab"]:not(:disabled)';

export function TabsList({ className, onKeyDown, ...props }: TabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // Tracks a trigger this effect gave a fallback tabIndex, so a later run can
  // unwind it before recomputing (e.g. if that trigger becomes disabled, or
  // the active trigger becomes focusable again).
  const fallbackTriggerRef = useRef<HTMLButtonElement | null>(null);

  // The roving tab stop normally follows the active trigger via the
  // `tabIndex={isActive ? 0 : -1}` below, but browsers never focus a
  // disabled element regardless of its tabIndex. If the active trigger is
  // disabled, no trigger would carry a real tab stop and the whole tablist
  // would drop out of the tab order. Re-point the tab stop at the first
  // focusable trigger in that case. Trigger children are opaque (arbitrary
  // wrappers, conditional rendering), so TabsList has no render-time view of
  // their `value`/`disabled` props -- this runs after every commit and reads
  // the same `listRef` + `TRIGGER_SELECTOR` the keydown handler already
  // uses, rather than inventing a separate registration mechanism.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    if (fallbackTriggerRef.current) {
      fallbackTriggerRef.current.tabIndex = -1;
      fallbackTriggerRef.current = null;
    }

    const activeTrigger = list.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );
    if (activeTrigger && !activeTrigger.disabled) {
      return;
    }

    const firstFocusable = list.querySelector<HTMLButtonElement>(TRIGGER_SELECTOR);
    if (firstFocusable) {
      firstFocusable.tabIndex = 0;
      fallbackTriggerRef.current = firstFocusable;
    }
  });

  // Focus moves without selecting; Enter/Space on the button activates.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !listRef.current) {
      return;
    }

    const triggers = Array.from(
      listRef.current.querySelectorAll<HTMLButtonElement>(TRIGGER_SELECTOR),
    );
    const index = triggers.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) {
      return;
    }

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % triggers.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + triggers.length) % triggers.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = triggers.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    triggers[nextIndex]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn('ds-tabs__list', className)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export type TabsTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> & {
  value: string;
};

export function TabsTrigger({ className, value, children, ...props }: TabsTriggerProps) {
  const { activeTab, setActiveTab, baseId } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={isActive ? 0 : -1}
      className={cn('ds-tabs__trigger', isActive && 'ds-tabs__trigger--active', className)}
      onClick={() => setActiveTab(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const { activeTab, baseId } = useTabsContext();
  if (activeTab !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn('ds-tabs__content', className)}
      {...props}
    >
      {children}
    </div>
  );
}
