import type { ButtonHTMLAttributes, HTMLAttributes, MouseEventHandler } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '../../lib/cn';
import { useRovingFocus } from '../../hooks/useRovingFocus';

type TabsContextValue = {
  activeTab: string;
  setActiveTab: (value: string) => void;
  baseId: string;
  /**
   * Which trigger currently owns the tablist's single tab stop. Normally the
   * active tab, but a disabled trigger can never receive focus, so TabsList
   * redirects it (see `TabsList`). `null` until resolved, and when no trigger
   * is focusable at all.
   */
  tabStopValue: string | null;
};

const TabsContext = createContext<TabsContextValue | null>(null);

/**
 * Split out from `TabsContextValue` so that TabsList publishing a resolved tab
 * stop does not re-render through the same context value every trigger reads.
 */
const TabStopSetterContext = createContext<((value: string | null) => void) | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be used within Tabs');
  }
  return context;
}

function useTabStopSetter() {
  const setTabStopValue = useContext(TabStopSetterContext);
  if (!setTabStopValue) {
    throw new Error('Tabs compound components must be used within Tabs');
  }
  return setTabStopValue;
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
  const [tabStopValue, setTabStopValue] = useState<string | null>(null);
  const activeTab = value ?? internalValue;

  const setActiveTab = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, baseId, tabStopValue }}>
      <TabStopSetterContext.Provider value={setTabStopValue}>
        <div className={cn('ds-tabs', className)} {...props}>
          {children}
        </div>
      </TabStopSetterContext.Provider>
    </TabsContext.Provider>
  );
}

export type TabsListProps = Omit<HTMLAttributes<HTMLDivElement>, 'role'>;

/**
 * Triggers are opaque `children`, so the tab stops are read from the DOM rather
 * than a ref array. The query is scoped to this list's own element, which keeps
 * two tablists on one page independent.
 */
const TRIGGER_SELECTOR = '[role="tab"]:not(:disabled)';

export function TabsList({ className, onKeyDown, ...props }: TabsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const setTabStopValue = useTabStopSetter();

  // A tablist must expose exactly one tab stop, and it normally belongs to the
  // active trigger. But a disabled element can never receive focus, so when the
  // active trigger is disabled that tab stop is a dead end and the entire
  // tablist drops out of the tab order. Resolve which trigger should really own
  // it, and publish that through context so the trigger *renders* the right
  // tabIndex.
  //
  // The resolution has to read the DOM: triggers are opaque children, so their
  // `disabled` props are invisible here at render time. But only the decision
  // is made here — writing `tabIndex` onto the node directly would fight React
  // for ownership of an attribute it also renders, leaving two elements
  // carrying `tabIndex={0}` and requiring a bookkeeping ref to undo the last
  // write before each recomputation.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const activeTrigger = list.querySelector<HTMLButtonElement>(
      '[role="tab"][aria-selected="true"]',
    );
    const owner =
      activeTrigger && !activeTrigger.disabled
        ? activeTrigger
        : list.querySelector<HTMLButtonElement>(TRIGGER_SELECTOR);

    setTabStopValue(owner?.dataset.value ?? null);
  });

  const getItems = useCallback(
    () => Array.from(listRef.current?.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR) ?? []),
    [],
  );
  // Focus moves without selecting; Enter/Space on the button activates.
  const navigate = useRovingFocus({ getItems, onNavigate: (_, item) => item.focus() });

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn('ds-tabs__list', className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) {
          navigate(event);
        }
      }}
      {...props}
    />
  );
}

// `id`, `role`, `aria-selected`, `aria-controls`, and `tabIndex` are all
// computed here: they wire this trigger to its TabsContent panel and carry the
// tablist's single tab stop. They are omitted from the props type rather than
// merely written before the spread, so a consumer cannot orphan the panel
// reference or hand the tablist a second tab stop. `onClick` is likewise
// omitted and re-declared so a consumer handler composes with tab activation
// instead of replacing it.
export type TabsTriggerProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'id' | 'role' | 'onClick' | 'aria-selected' | 'aria-controls' | 'tabIndex'
> & {
  value: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export function TabsTrigger({ className, value, children, onClick, ...props }: TabsTriggerProps) {
  const { activeTab, setActiveTab, baseId, tabStopValue } = useTabsContext();
  const isActive = activeTab === value;

  // Before TabsList has resolved an owner, fall back to the active trigger so
  // the tablist is never briefly unreachable by keyboard on first paint.
  const ownsTabStop = tabStopValue === null ? isActive : tabStopValue === value;

  return (
    <button
      type="button"
      role="tab"
      // Read back by TabsList to identify which trigger owns the tab stop.
      data-value={value}
      id={`${baseId}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={ownsTabStop ? 0 : -1}
      className={cn('ds-tabs__trigger', isActive && 'ds-tabs__trigger--active', className)}
      onClick={(event) => {
        onClick?.(event);
        setActiveTab(value);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

// `id`, `role`, and `aria-labelledby` are computed here and wire this panel
// back to its trigger, so they are omitted for the same reason as on
// TabsTrigger.
export type TabsContentProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'id' | 'role' | 'aria-labelledby'
> & {
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
