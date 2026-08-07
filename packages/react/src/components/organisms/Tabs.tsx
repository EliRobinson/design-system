import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent } from 'react';
import { createContext, useContext, useId, useRef, useState } from 'react';

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
