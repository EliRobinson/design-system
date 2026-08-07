# Component Library Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `@elirobinson/react` into atomic-design tiers (atoms/molecules/organisms) and add 19 new components plus TanStack-backed infrastructure so the library covers the common Material 3 / Apple HIG pattern surface for general-purpose site building.

**Architecture:** Existing 24 components move into three tier folders with no behavior change. New components are added tier-by-tier (atoms → molecules → TanStack infra → organisms) so later components can depend on earlier ones. Every component follows the established pattern: `forwardRef`, `cn()` class helper, styles added to `packages/react/src/styles.css` using existing CSS custom properties, a Storybook story, and — where the component has non-trivial interaction logic — a Vitest + Testing Library test.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react, Storybook (`@storybook/react-vite`), `@tanstack/react-table`, `@tanstack/react-virtual`, `@tanstack/react-form`.

## Global Constraints

- Package manager: pnpm (`pnpm@10.11.1`). Never use npm/yarn.
- No barrel files — every component is imported via its own subpath (`@elirobinson/react/components/<tier>/<Name>`, or `@design-system/react/components/<tier>/<Name>` inside this workspace via the Storybook alias).
- All visual values come from CSS custom properties already defined in `packages/react/src/styles.css` / `@elirobinson/tokens` — never hardcode colors, spacing, or radii, and never introduce Tailwind.
- `forwardRef` for every component that renders a focusable/interactive native element. 44px minimum touch target on interactive elements. Visible `:focus-visible` ring using `var(--focus-ring)`.
- Skip Radix/Tailwind. TanStack (`react-table`, `react-virtual`, `react-form`) is the one approved exception, adopted per `docs/superpowers/specs/2026-08-06-component-library-expansion-design.md` section C — headless logic only, we own all styling.
- Every component gets a Storybook story at `apps/storybook/src/stories/<Name>.stories.tsx`, title `Components/<Name>`, importing from `@design-system/react/components/<tier>/<Name>`.
- Component tests live beside the component as `<Name>.test.tsx`, using `describe`/`it`/`expect` from `vitest` and `render`/`screen` from `@testing-library/react`.
- Commit after every task using the existing repo commit style (see `docs/agents/git-workflow.md` if present; otherwise short imperative subject line).

## File Structure

```
packages/react/src/
  components/
    atoms/       Avatar, Badge, Button, Checkbox, Eyebrow, Input, Label, Progress,
                  Separator, Skeleton, Switch, Textarea, RadioGroup, Spinner, Slider, Kbd
    molecules/   Alert, Breadcrumb, Card, RuleLink, Chip, FormField, SearchField,
                  Pagination, Stepper, SegmentedControl, EmptyState, Rating
    organisms/   Dialog, DropdownMenu, Popover, Select, Sheet, Tabs, Toast, Tooltip,
                  Accordion, Combobox, DatePicker, Table, CommandPalette, NavigationMenu,
                  VirtualList
  hooks/         useAnchoredPosition.ts, useClickOutside.ts, useEscapeKey.ts, useDsForm.ts
  lib/cn.ts
  styles.css
```

Each `.tsx` file keeps one component (plus its tightly-coupled compound subcomponents, e.g. `Accordion` + `AccordionItem` + `AccordionTrigger` + `AccordionContent` in one file) per the codebase's existing convention (see `Tabs.tsx`, `Dialog.tsx`).

---

## Task 1: Reorganize existing components into atomic tiers

**Files:**

- Create dirs: `packages/react/src/components/atoms/`, `packages/react/src/components/molecules/`, `packages/react/src/components/organisms/`
- Move (via `git mv`) all 24 existing component files + their `.test.tsx` files into the tier listed in the File Structure section above
- Modify: all 25 files in `apps/storybook/src/stories/*.stories.tsx` (update import paths)
- Modify: `docs/agents/components.md` (add tier boundary rule, update shadcn mapping table with tiers)

**Interfaces:**

- Produces: the tier folder layout and import path convention (`@design-system/react/components/<tier>/<Name>`) every later task in this plan depends on.

- [ ] **Step 1: Create the tier directories**

```bash
mkdir -p packages/react/src/components/atoms packages/react/src/components/molecules packages/react/src/components/organisms
```

- [ ] **Step 2: Move atoms**

```bash
cd packages/react/src/components
git mv Avatar.tsx atoms/Avatar.tsx
git mv Badge.tsx atoms/Badge.tsx
git mv Button.tsx atoms/Button.tsx
git mv Checkbox.tsx atoms/Checkbox.tsx
git mv Checkbox.test.tsx atoms/Checkbox.test.tsx
git mv Eyebrow.tsx atoms/Eyebrow.tsx
git mv Input.tsx atoms/Input.tsx
git mv Label.tsx atoms/Label.tsx
git mv Progress.tsx atoms/Progress.tsx
git mv Separator.tsx atoms/Separator.tsx
git mv Skeleton.tsx atoms/Skeleton.tsx
git mv Switch.tsx atoms/Switch.tsx
git mv Switch.test.tsx atoms/Switch.test.tsx
git mv Textarea.tsx atoms/Textarea.tsx
```

- [ ] **Step 3: Move molecules**

```bash
git mv Alert.tsx molecules/Alert.tsx
git mv Breadcrumb.tsx molecules/Breadcrumb.tsx
git mv Card.tsx molecules/Card.tsx
git mv RuleLink.tsx molecules/RuleLink.tsx
```

- [ ] **Step 4: Move organisms**

```bash
git mv Dialog.tsx organisms/Dialog.tsx
git mv Dialog.test.tsx organisms/Dialog.test.tsx
git mv DropdownMenu.tsx organisms/DropdownMenu.tsx
git mv Popover.tsx organisms/Popover.tsx
git mv Select.tsx organisms/Select.tsx
git mv Sheet.tsx organisms/Sheet.tsx
git mv Tabs.tsx organisms/Tabs.tsx
git mv Tabs.test.tsx organisms/Tabs.test.tsx
git mv Toast.tsx organisms/Toast.tsx
git mv Tooltip.tsx organisms/Tooltip.tsx
cd ../../../../..
```

- [ ] **Step 5: Verify no file was left behind**

Run: `find packages/react/src/components -maxdepth 1 -type f`
Expected: empty output (only the three tier directories remain).

- [ ] **Step 6: Update every Storybook story import**

For each file in `apps/storybook/src/stories/*.stories.tsx`, change the import line from:

```ts
import { X } from '@design-system/react/components/X';
```

to the tiered path, e.g. for `Button.stories.tsx`:

```ts
import { Button } from '@design-system/react/components/atoms/Button';
```

Use this mapping (component → tier):

- atoms: Avatar, Badge, Button, Checkbox, Eyebrow, Input, Label, Progress, Separator, Skeleton, Switch, Textarea
- molecules: Alert, Breadcrumb, Card, RuleLink
- organisms: Dialog, DropdownMenu, Popover, Select, Sheet, Tabs, Toast, Tooltip

`MarketingPattern.stories.tsx` composes multiple components — update every import in that file too.

- [ ] **Step 7: Update `docs/agents/components.md`**

Add this section right after "## shadcn component adoption":

```markdown
## Atomic tiers

Components live under `packages/react/src/components/<tier>/`:

- **atoms/** — single-purpose, not further divisible (e.g. `Button`, `Input`).
- **molecules/** — a few atoms combined into one functional unit, no portal/overlay orchestration (e.g. `Card`, `Alert`).
- **organisms/** — compound components with internal state and/or overlay orchestration: portals, focus trapping, keyboard nav (e.g. `Dialog`, `Select`).

Boundary rule: if a component renders into a portal, traps focus, or manages open/closed state across multiple sub-elements, it's an organism. If it's assembled from 2+ atoms with no such orchestration, it's a molecule. Otherwise it's an atom.

Import via the tiered subpath: `@elirobinson/react/components/<tier>/<Name>`.
```

Update the shadcn mapping table's first column header from `shadcn component` — leave the table as-is otherwise (tier info now lives in the section above, no need to duplicate per-row).

- [ ] **Step 8: Run the full verification suite**

Run: `pnpm build && pnpm test && pnpm lint && pnpm typecheck`
Expected: all four pass with no errors (existing warnings unrelated to this move are fine).

Run: `pnpm --filter @design-system/storybook build` (or the repo's storybook build script — check `apps/storybook/package.json` `scripts` if the filter name differs)
Expected: builds with no missing-module errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(react): reorganize components into atomic tiers"
```

---

## Task 2: Add RadioGroup atom

**Files:**

- Create: `packages/react/src/components/atoms/RadioGroup.tsx`
- Test: `packages/react/src/components/atoms/RadioGroup.test.tsx`
- Story: `apps/storybook/src/stories/RadioGroup.stories.tsx`
- Modify: `packages/react/src/styles.css` (append `.ds-radio-group` rules)

**Interfaces:**

- Produces: `RadioGroup` (context provider), `RadioGroupItem` (compound child) — same context-provider compound pattern as `Tabs` (`organisms/Tabs.tsx`), reused conceptually by `SegmentedControl` (Task 11) and `Accordion` (Task 16).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/atoms/RadioGroup.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup, RadioGroupItem } from './RadioGroup';

describe('RadioGroup', () => {
  it('selects the item marked as the default value', () => {
    render(
      <RadioGroup name="plan" defaultValue="pro">
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Free' })).not.toBeChecked();
  });

  it('calls onValueChange when a different item is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <RadioGroup name="plan" defaultValue="free" onValueChange={onValueChange}>
        <RadioGroupItem value="free" label="Free" />
        <RadioGroupItem value="pro" label="Pro" />
      </RadioGroup>,
    );

    await user.click(screen.getByRole('radio', { name: 'Pro' }));

    expect(onValueChange).toHaveBeenCalledWith('pro');
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeChecked();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- RadioGroup`
Expected: FAIL — `./RadioGroup` module not found.

- [ ] **Step 3: Implement RadioGroup**

```tsx
// packages/react/src/components/atoms/RadioGroup.tsx
import type { HTMLAttributes, InputHTMLAttributes } from 'react';
import { createContext, useContext, useId, useState } from 'react';

import { cn } from '../../lib/cn';

type RadioGroupContextValue = {
  name: string;
  value: string | undefined;
  setValue: (value: string) => void;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error('RadioGroupItem must be used within RadioGroup');
  }
  return context;
}

export type RadioGroupProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function RadioGroup({
  className,
  name,
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: RadioGroupProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = value ?? internalValue;

  const setValue = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  };

  return (
    <RadioGroupContext.Provider value={{ name, value: currentValue, setValue }}>
      <div role="radiogroup" className={cn('ds-radio-group', className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export type RadioGroupItemProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'name' | 'checked' | 'onChange'
> & {
  value: string;
  label: string;
};

export function RadioGroupItem({ className, value, label, id, ...props }: RadioGroupItemProps) {
  const { name, value: groupValue, setValue } = useRadioGroupContext();
  const generatedId = useId();
  const itemId = id ?? generatedId;

  return (
    <div className="ds-radio-group__item">
      <input
        type="radio"
        id={itemId}
        name={name}
        value={value}
        checked={groupValue === value}
        onChange={() => setValue(value)}
        className={cn('ds-radio-group__input', className)}
        {...props}
      />
      <label htmlFor={itemId} className="ds-radio-group__label">
        {label}
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

Append to `packages/react/src/styles.css`:

```css
.ds-radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ds-radio-group__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
}

.ds-radio-group__input {
  width: 20px;
  height: 20px;
  accent-color: var(--accent);
}

.ds-radio-group__input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.ds-radio-group__label {
  font-size: var(--fs-sm);
  color: var(--fg);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- RadioGroup`
Expected: PASS (2 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/RadioGroup.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadioGroup, RadioGroupItem } from '@design-system/react/components/atoms/RadioGroup';

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup name="plan" defaultValue="pro">
      <RadioGroupItem value="free" label="Free" />
      <RadioGroupItem value="pro" label="Pro" />
      <RadioGroupItem value="enterprise" label="Enterprise" />
    </RadioGroup>
  ),
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/atoms/RadioGroup.tsx packages/react/src/components/atoms/RadioGroup.test.tsx packages/react/src/styles.css apps/storybook/src/stories/RadioGroup.stories.tsx
git commit -m "feat(react): add RadioGroup atom"
```

---

## Task 3: Add Spinner atom

**Files:**

- Create: `packages/react/src/components/atoms/Spinner.tsx`
- Story: `apps/storybook/src/stories/Spinner.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `Spinner` — indeterminate loading atom, consumed by `Table` (Task 19) and `Combobox` (Task 18) for async/loading states.

- [ ] **Step 1: Implement Spinner**

```tsx
// packages/react/src/components/atoms/Spinner.tsx
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export type SpinnerProps = HTMLAttributes<HTMLSpanElement> & {
  size?: SpinnerSize;
  label?: string;
};

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { className, size = 'md', label = 'Loading', ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      role="status"
      aria-label={label}
      className={cn('ds-spinner', `ds-spinner--${size}`, className)}
      {...props}
    />
  );
});
```

- [ ] **Step 2: Add styles**

```css
.ds-spinner {
  display: inline-block;
  border-radius: 9999px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  animation: ds-spin var(--dur-normal, 0.6s) linear infinite;
}

.ds-spinner--sm {
  width: 16px;
  height: 16px;
}

.ds-spinner--md {
  width: 24px;
  height: 24px;
}

.ds-spinner--lg {
  width: 40px;
  height: 40px;
  border-width: 3px;
}

@keyframes ds-spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 3: Verify visually**

Run: `pnpm --filter @elirobinson/react build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Add Storybook story**

```tsx
// apps/storybook/src/stories/Spinner.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from '@design-system/react/components/atoms/Spinner';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/atoms/Spinner.tsx packages/react/src/styles.css apps/storybook/src/stories/Spinner.stories.tsx
git commit -m "feat(react): add Spinner atom"
```

---

## Task 4: Add Slider atom

**Files:**

- Create: `packages/react/src/components/atoms/Slider.tsx`
- Story: `apps/storybook/src/stories/Slider.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `Slider` — wraps native `<input type="range">`, forwardRef to the input element.

- [ ] **Step 1: Implement Slider**

```tsx
// packages/react/src/components/atoms/Slider.tsx
import type { InputHTMLAttributes } from 'react';
import { forwardRef, useId } from 'react';

import { cn } from '../../lib/cn';

export type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
};

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, id, label, ...props },
  ref,
) {
  const generatedId = useId();
  const sliderId = id ?? generatedId;

  return (
    <div className="ds-slider">
      {label ? (
        <label htmlFor={sliderId} className="ds-slider__label">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        type="range"
        id={sliderId}
        className={cn('ds-slider__input', className)}
        {...props}
      />
    </div>
  );
});
```

- [ ] **Step 2: Add styles**

```css
.ds-slider {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.ds-slider__label {
  font-size: var(--fs-sm);
  color: var(--fg-2);
}

.ds-slider__input {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 44px;
  background: transparent;
}

.ds-slider__input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--radius-pill);
  background: var(--border);
}

.ds-slider__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -8px;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background: var(--accent);
  border: 2px solid var(--surface);
  box-shadow: var(--shadow-sm);
}

.ds-slider__input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @elirobinson/react build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Add Storybook story**

```tsx
// apps/storybook/src/stories/Slider.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from '@design-system/react/components/atoms/Slider';

const meta = {
  title: 'Components/Slider',
  component: Slider,
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Volume', min: 0, max: 100, defaultValue: 50 },
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/atoms/Slider.tsx packages/react/src/styles.css apps/storybook/src/stories/Slider.stories.tsx
git commit -m "feat(react): add Slider atom"
```

---

## Task 5: Add Kbd atom

**Files:**

- Create: `packages/react/src/components/atoms/Kbd.tsx`
- Story: `apps/storybook/src/stories/Kbd.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `Kbd` — consumed by `CommandPalette` (Task 21) to render shortcut hints.

- [ ] **Step 1: Implement Kbd**

```tsx
// packages/react/src/components/atoms/Kbd.tsx
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type KbdProps = HTMLAttributes<HTMLElement>;

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd({ className, ...props }, ref) {
  return <kbd ref={ref} className={cn('ds-kbd', className)} {...props} />;
});
```

- [ ] **Step 2: Add styles**

```css
.ds-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--bg-subtle);
  font-family: var(--font-mono);
  font-size: var(--fs-2xs);
  color: var(--fg-2);
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 3: Add Storybook story**

```tsx
// apps/storybook/src/stories/Kbd.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from '@design-system/react/components/atoms/Kbd';

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ShortcutHint: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 4 }}>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </div>
  ),
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/components/atoms/Kbd.tsx packages/react/src/styles.css apps/storybook/src/stories/Kbd.stories.tsx
git commit -m "feat(react): add Kbd atom"
```

---

## Task 6: Add Chip molecule

**Files:**

- Create: `packages/react/src/components/molecules/Chip.tsx`
- Test: `packages/react/src/components/molecules/Chip.test.tsx`
- Story: `apps/storybook/src/stories/Chip.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Consumes: none.
- Produces: `Chip` — used as the option-render pattern reference for `Combobox` multi-select (Task 18).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/molecules/Chip.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './Chip';

describe('Chip', () => {
  it('renders its label', () => {
    render(<Chip>Design</Chip>);
    expect(screen.getByText('Design')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(<Chip onRemove={onRemove}>Design</Chip>);
    await user.click(screen.getByRole('button', { name: 'Remove Design' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not render a remove button when onRemove is omitted', () => {
    render(<Chip>Design</Chip>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- Chip`
Expected: FAIL — `./Chip` module not found.

- [ ] **Step 3: Implement Chip**

```tsx
// packages/react/src/components/molecules/Chip.tsx
import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  onRemove?: () => void;
};

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { className, onRemove, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn('ds-chip', className)} {...props}>
      <span className="ds-chip__label">{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="ds-chip__remove"
          aria-label={`Remove ${children}`}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </span>
  );
});
```

- [ ] **Step 4: Add styles**

```css
.ds-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  font-size: var(--fs-xs);
  color: var(--fg);
}

.ds-chip__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: var(--fg-3);
  cursor: pointer;
  font-size: var(--fs-sm);
  line-height: 1;
}

.ds-chip__remove:hover {
  background: var(--border);
  color: var(--fg);
}

.ds-chip__remove:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- Chip`
Expected: PASS (3 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/Chip.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chip } from '@design-system/react/components/molecules/Chip';

const meta = {
  title: 'Components/Chip',
  component: Chip,
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Removable: Story = {
  args: { children: 'Design', onRemove: () => {} },
};

export const Static: Story = {
  args: { children: 'Read only' },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/molecules/Chip.tsx packages/react/src/components/molecules/Chip.test.tsx packages/react/src/styles.css apps/storybook/src/stories/Chip.stories.tsx
git commit -m "feat(react): add Chip molecule"
```

---

## Task 7: Add FormField molecule

**Files:**

- Create: `packages/react/src/components/molecules/FormField.tsx`
- Test: `packages/react/src/components/molecules/FormField.test.tsx`
- Story: `apps/storybook/src/stories/FormField.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Consumes: `Label` (`../atoms/Label`).
- Produces: `FormField` — wraps a single form control with label/hint/error, exposes `describedById` via render prop so any input (including `SearchField`, Task 8, and consumer-supplied `Input`/`Select`) can wire `aria-describedby` itself.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/molecules/FormField.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField } from './FormField';

describe('FormField', () => {
  it('associates the label with the child input via htmlFor/id', () => {
    render(
      <FormField label="Email" htmlFor="email">
        {(describedById) => <input id="email" aria-describedby={describedById} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders error text and wires it to aria-describedby', () => {
    render(
      <FormField label="Email" htmlFor="email" error="Required">
        {(describedById) => <input id="email" aria-describedby={describedById} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Email');
    const message = screen.getByText('Required');
    expect(input).toHaveAttribute('aria-describedby', message.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders hint text when there is no error', () => {
    render(
      <FormField label="Email" htmlFor="email" hint="We'll never share this">
        {(describedById) => <input id="email" aria-describedby={describedById} />}
      </FormField>,
    );

    expect(screen.getByText("We'll never share this")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- FormField`
Expected: FAIL — `./FormField` module not found.

- [ ] **Step 3: Implement FormField**

```tsx
// packages/react/src/components/molecules/FormField.tsx
import type { HTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

import { cn } from '../../lib/cn';
import { Label } from '../atoms/Label';

export type FormFieldProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (describedById: string | undefined) => ReactNode;
};

export function FormField({
  className,
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  ...props
}: FormFieldProps) {
  const generatedId = useId();
  const messageId = error || hint ? generatedId : undefined;

  return (
    <div className={cn('ds-form-field', className)} {...props}>
      <Label htmlFor={htmlFor} className="ds-form-field__label">
        {label}
        {required ? <span className="ds-form-field__required"> *</span> : null}
      </Label>
      {children(messageId)}
      {error ? (
        <p id={messageId} className="ds-form-field__message ds-form-field__message--error">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="ds-form-field__message ds-form-field__message--hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
```

Note: consumers pass `aria-invalid` themselves via the render-prop child when `error` is set (the test above sets it manually since `FormField` doesn't control the child's props directly — it only supplies the `describedById`). Update the test's third assertion accordingly by having the story/consumer set `aria-invalid={Boolean(error)}` — for this task's test, add that prop explicitly in the test's render:

```tsx
<FormField label="Email" htmlFor="email" error="Required">
  {(describedById) => <input id="email" aria-describedby={describedById} aria-invalid="true" />}
</FormField>
```

(Adjust the Step 1 test code above to pass `aria-invalid="true"` explicitly on the child input in the error test case before running Step 2.)

- [ ] **Step 4: Add styles**

```css
.ds-form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.ds-form-field__label {
  margin-bottom: 2px;
}

.ds-form-field__required {
  color: var(--status-danger);
}

.ds-form-field__message {
  font-size: var(--fs-xs);
  margin: 0;
}

.ds-form-field__message--hint {
  color: var(--fg-3);
}

.ds-form-field__message--error {
  color: var(--status-danger);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- FormField`
Expected: PASS (3 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/FormField.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormField } from '@design-system/react/components/molecules/FormField';
import { Input } from '@design-system/react/components/atoms/Input';

const meta = {
  title: 'Components/FormField',
  component: FormField,
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHint: Story = {
  render: () => (
    <FormField label="Email" htmlFor="email-hint" hint="We'll never share this">
      {(describedById) => <Input id="email-hint" aria-describedby={describedById} />}
    </FormField>
  ),
};

export const WithError: Story = {
  render: () => (
    <FormField label="Email" htmlFor="email-error" error="Enter a valid email" required>
      {(describedById) => (
        <Input id="email-error" aria-describedby={describedById} aria-invalid="true" />
      )}
    </FormField>
  ),
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/molecules/FormField.tsx packages/react/src/components/molecules/FormField.test.tsx packages/react/src/styles.css apps/storybook/src/stories/FormField.stories.tsx
git commit -m "feat(react): add FormField molecule"
```

---

## Task 8: Add SearchField molecule

**Files:**

- Create: `packages/react/src/components/molecules/SearchField.tsx`
- Test: `packages/react/src/components/molecules/SearchField.test.tsx`
- Story: `apps/storybook/src/stories/SearchField.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Consumes: `Input` (`../atoms/Input`).
- Produces: `SearchField` — reused by `Combobox` (Task 18) as its filter input.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/molecules/SearchField.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('renders a search input', () => {
    render(<SearchField aria-label="Search" />);
    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeInTheDocument();
  });

  it('shows a clear button only when there is a value, and clears on click', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SearchField aria-label="Search" value="hello" onValueChange={onValueChange} />);

    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    await user.click(clearButton);

    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('does not render a clear button when empty', () => {
    render(<SearchField aria-label="Search" value="" onValueChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- SearchField`
Expected: FAIL — `./SearchField` module not found.

- [ ] **Step 3: Implement SearchField**

```tsx
// packages/react/src/components/molecules/SearchField.tsx
import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  value?: string;
  onValueChange?: (value: string) => void;
};

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { className, value, onValueChange, ...props },
  ref,
) {
  return (
    <div className={cn('ds-search-field', className)}>
      <span className="ds-search-field__icon" aria-hidden="true">
        ⌕
      </span>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
        className="ds-search-field__input"
        {...props}
      />
      {value ? (
        <button
          type="button"
          className="ds-search-field__clear"
          aria-label="Clear search"
          onClick={() => onValueChange?.('')}
        >
          ×
        </button>
      ) : null}
    </div>
  );
});
```

- [ ] **Step 4: Add styles**

```css
.ds-search-field {
  position: relative;
  display: flex;
  align-items: center;
}

.ds-search-field__icon {
  position: absolute;
  left: var(--space-3);
  color: var(--fg-3);
  pointer-events: none;
}

.ds-search-field__input {
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-8) 0 var(--space-8);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  font-size: var(--fs-sm);
}

.ds-search-field__input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

.ds-search-field__clear {
  position: absolute;
  right: var(--space-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: var(--fg-3);
  cursor: pointer;
  font-size: var(--fs-md);
}

.ds-search-field__clear:hover {
  background: var(--bg-subtle);
  color: var(--fg);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- SearchField`
Expected: PASS (3 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/SearchField.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from '@design-system/react/components/molecules/SearchField';

const meta = {
  title: 'Components/SearchField',
  component: SearchField,
} satisfies Meta<typeof SearchField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('');
    return <SearchField aria-label="Search" value={value} onValueChange={setValue} />;
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/molecules/SearchField.tsx packages/react/src/components/molecules/SearchField.test.tsx packages/react/src/styles.css apps/storybook/src/stories/SearchField.stories.tsx
git commit -m "feat(react): add SearchField molecule"
```

---

## Task 9: Add Pagination molecule

**Files:**

- Create: `packages/react/src/components/molecules/Pagination.tsx`
- Test: `packages/react/src/components/molecules/Pagination.test.tsx`
- Story: `apps/storybook/src/stories/Pagination.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `Pagination` — `{ page: number; pageCount: number; onPageChange: (page: number) => void }`. Consumed by `Table` (Task 19) as its footer control.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/molecules/Pagination.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('disables Previous on the first page and Next on the last page', () => {
    render(<Pagination page={1} pageCount={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
  });

  it('calls onPageChange with the next page number', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when a page number is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- Pagination`
Expected: FAIL — `./Pagination` module not found.

- [ ] **Step 3: Implement Pagination**

```tsx
// packages/react/src/components/molecules/Pagination.tsx
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type PaginationProps = Omit<HTMLAttributes<HTMLElement>, 'onChange'> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function Pagination({
  className,
  page,
  pageCount,
  onPageChange,
  ...props
}: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination" className={cn('ds-pagination', className)} {...props}>
      <button
        type="button"
        className="ds-pagination__nav"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ‹
      </button>
      <ul className="ds-pagination__list">
        {pages.map((pageNumber) => (
          <li key={pageNumber}>
            <button
              type="button"
              aria-label={`Page ${pageNumber}`}
              aria-current={pageNumber === page ? 'page' : undefined}
              className={cn(
                'ds-pagination__item',
                pageNumber === page && 'ds-pagination__item--active',
              )}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="ds-pagination__nav"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        ›
      </button>
    </nav>
  );
}
```

- [ ] **Step 4: Add styles**

```css
.ds-pagination {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.ds-pagination__list {
  display: flex;
  gap: var(--space-1);
  list-style: none;
  margin: 0;
  padding: 0;
}

.ds-pagination__nav,
.ds-pagination__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
  cursor: pointer;
  font-size: var(--fs-sm);
}

.ds-pagination__nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ds-pagination__item--active {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}

.ds-pagination__nav:focus-visible,
.ds-pagination__item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- Pagination`
Expected: PASS (3 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/Pagination.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pagination } from '@design-system/react/components/molecules/Pagination';

const meta = {
  title: 'Components/Pagination',
  component: Pagination,
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [page, setPage] = useState(1);
    return <Pagination page={page} pageCount={5} onPageChange={setPage} />;
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/molecules/Pagination.tsx packages/react/src/components/molecules/Pagination.test.tsx packages/react/src/styles.css apps/storybook/src/stories/Pagination.stories.tsx
git commit -m "feat(react): add Pagination molecule"
```

---

## Task 10: Add Stepper molecule

**Files:**

- Create: `packages/react/src/components/molecules/Stepper.tsx`
- Story: `apps/storybook/src/stories/Stepper.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `Stepper` — `{ steps: { label: string }[]; activeStep: number }`, presentational (no test file, consistent with the repo's convention for presentational-only components like `Breadcrumb`).

- [ ] **Step 1: Implement Stepper**

```tsx
// packages/react/src/components/molecules/Stepper.tsx
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type StepperStep = {
  label: string;
};

export type StepperProps = HTMLAttributes<HTMLOListElement> & {
  steps: StepperStep[];
  activeStep: number;
};

export function Stepper({ className, steps, activeStep, ...props }: StepperProps) {
  return (
    <ol className={cn('ds-stepper', className)} {...props}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < activeStep;
        const isActive = stepNumber === activeStep;

        return (
          <li
            key={step.label}
            className={cn(
              'ds-stepper__step',
              isComplete && 'ds-stepper__step--complete',
              isActive && 'ds-stepper__step--active',
            )}
            aria-current={isActive ? 'step' : undefined}
          >
            <span className="ds-stepper__indicator">{isComplete ? '✓' : stepNumber}</span>
            <span className="ds-stepper__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Add styles**

```css
.ds-stepper {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
}

.ds-stepper__step {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  font-size: var(--fs-sm);
  color: var(--fg-3);
}

.ds-stepper__step:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
  margin: 0 var(--space-2);
}

.ds-stepper__indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 9999px;
  border: 1px solid var(--border-strong);
  font-size: var(--fs-xs);
  flex-shrink: 0;
}

.ds-stepper__step--active .ds-stepper__indicator {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-fg);
}

.ds-stepper__step--active .ds-stepper__label {
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.ds-stepper__step--complete .ds-stepper__indicator {
  border-color: var(--status-success);
  background: var(--status-success);
  color: var(--surface);
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @elirobinson/react build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Add Storybook story**

```tsx
// apps/storybook/src/stories/Stepper.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper } from '@design-system/react/components/molecules/Stepper';

const meta = {
  title: 'Components/Stepper',
  component: Stepper,
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    steps: [{ label: 'Account' }, { label: 'Details' }, { label: 'Review' }],
    activeStep: 2,
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/molecules/Stepper.tsx packages/react/src/styles.css apps/storybook/src/stories/Stepper.stories.tsx
git commit -m "feat(react): add Stepper molecule"
```

---

## Task 11: Add SegmentedControl molecule

**Files:**

- Create: `packages/react/src/components/molecules/SegmentedControl.tsx`
- Test: `packages/react/src/components/molecules/SegmentedControl.test.tsx`
- Story: `apps/storybook/src/stories/SegmentedControl.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `SegmentedControl` — `{ options: { label: string; value: string }[]; value: string; onValueChange: (value: string) => void }`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/molecules/SegmentedControl.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

const options = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
];

describe('SegmentedControl', () => {
  it('marks the selected option as checked', () => {
    render(<SegmentedControl options={options} value="week" onValueChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Day' })).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onValueChange when a different option is clicked', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<SegmentedControl options={options} value="day" onValueChange={onValueChange} />);
    await user.click(screen.getByRole('radio', { name: 'Month' }));

    expect(onValueChange).toHaveBeenCalledWith('month');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- SegmentedControl`
Expected: FAIL — `./SegmentedControl` module not found.

- [ ] **Step 3: Implement SegmentedControl**

```tsx
// packages/react/src/components/molecules/SegmentedControl.tsx
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type SegmentedControlOption = {
  label: string;
  value: string;
};

export type SegmentedControlProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  options: SegmentedControlOption[];
  value: string;
  onValueChange: (value: string) => void;
};

export function SegmentedControl({
  className,
  options,
  value,
  onValueChange,
  ...props
}: SegmentedControlProps) {
  return (
    <div role="radiogroup" className={cn('ds-segmented-control', className)} {...props}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={cn(
              'ds-segmented-control__item',
              isActive && 'ds-segmented-control__item--active',
            )}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

```css
.ds-segmented-control {
  display: inline-flex;
  padding: 2px;
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
}

.ds-segmented-control__item {
  min-width: 44px;
  min-height: 40px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--fg-2);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.ds-segmented-control__item--active {
  background: var(--surface);
  color: var(--fg);
  box-shadow: var(--shadow-sm);
}

.ds-segmented-control__item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- SegmentedControl`
Expected: PASS (2 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/SegmentedControl.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from '@design-system/react/components/molecules/SegmentedControl';

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('day');
    return (
      <SegmentedControl
        options={[
          { label: 'Day', value: 'day' },
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
        ]}
        value={value}
        onValueChange={setValue}
      />
    );
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/molecules/SegmentedControl.tsx packages/react/src/components/molecules/SegmentedControl.test.tsx packages/react/src/styles.css apps/storybook/src/stories/SegmentedControl.stories.tsx
git commit -m "feat(react): add SegmentedControl molecule"
```

---

## Task 12: Add EmptyState molecule

**Files:**

- Create: `packages/react/src/components/molecules/EmptyState.tsx`
- Story: `apps/storybook/src/stories/EmptyState.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `EmptyState` — presentational, consumed by `Table` (Task 19) for the zero-rows case.

- [ ] **Step 1: Implement EmptyState**

```tsx
// packages/react/src/components/molecules/EmptyState.tsx
import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../../lib/cn';

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  className,
  title,
  description,
  icon,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn('ds-empty-state', className)} {...props}>
      {icon ? <div className="ds-empty-state__icon">{icon}</div> : null}
      <p className="ds-empty-state__title">{title}</p>
      {description ? <p className="ds-empty-state__description">{description}</p> : null}
      {action ? <div className="ds-empty-state__action">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 2: Add styles**

```css
.ds-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--fg-3);
}

.ds-empty-state__icon {
  font-size: var(--fs-lg);
  color: var(--fg-4);
}

.ds-empty-state__title {
  margin: 0;
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
  color: var(--fg);
}

.ds-empty-state__description {
  margin: 0;
  font-size: var(--fs-sm);
}

.ds-empty-state__action {
  margin-top: var(--space-2);
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @elirobinson/react build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Add Storybook story**

```tsx
// apps/storybook/src/stories/EmptyState.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '@design-system/react/components/molecules/EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'No results found',
    description: 'Try adjusting your filters or search term.',
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/molecules/EmptyState.tsx packages/react/src/styles.css apps/storybook/src/stories/EmptyState.stories.tsx
git commit -m "feat(react): add EmptyState molecule"
```

---

## Task 13: Add Rating molecule

**Files:**

- Create: `packages/react/src/components/molecules/Rating.tsx`
- Test: `packages/react/src/components/molecules/Rating.test.tsx`
- Story: `apps/storybook/src/stories/Rating.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `Rating` — `{ value: number; max?: number; onValueChange?: (value: number) => void }`. Read-only when `onValueChange` is omitted.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/molecules/Rating.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Rating } from './Rating';

describe('Rating', () => {
  it('renders as a static value with no buttons when onValueChange is omitted', () => {
    render(<Rating value={3} />);
    expect(screen.getByRole('img', { name: '3 out of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders interactive star buttons and calls onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<Rating value={2} onValueChange={onValueChange} />);
    await user.click(screen.getByRole('button', { name: 'Rate 4 out of 5 stars' }));

    expect(onValueChange).toHaveBeenCalledWith(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- Rating`
Expected: FAIL — `./Rating` module not found.

- [ ] **Step 3: Implement Rating**

```tsx
// packages/react/src/components/molecules/Rating.tsx
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type RatingProps = HTMLAttributes<HTMLDivElement> & {
  value: number;
  max?: number;
  onValueChange?: (value: number) => void;
};

export function Rating({ className, value, max = 5, onValueChange, ...props }: RatingProps) {
  const stars = Array.from({ length: max }, (_, index) => index + 1);
  const isInteractive = Boolean(onValueChange);

  if (!isInteractive) {
    return (
      <div
        role="img"
        aria-label={`${value} out of ${max} stars`}
        className={cn('ds-rating', className)}
        {...props}
      >
        {stars.map((star) => (
          <span
            key={star}
            aria-hidden="true"
            className={cn('ds-rating__star', star <= value && 'ds-rating__star--filled')}
          >
            ★
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('ds-rating', className)} {...props}>
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Rate ${star} out of ${max} stars`}
          className={cn('ds-rating__button', star <= value && 'ds-rating__star--filled')}
          onClick={() => onValueChange?.(star)}
        >
          <span aria-hidden="true">★</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

```css
.ds-rating {
  display: inline-flex;
  gap: 2px;
}

.ds-rating__star {
  color: var(--border-strong);
  font-size: var(--fs-lg);
}

.ds-rating__star--filled {
  color: var(--signal-800, var(--accent));
}

.ds-rating__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--border-strong);
  font-size: var(--fs-lg);
  cursor: pointer;
}

.ds-rating__button.ds-rating__star--filled {
  color: var(--signal-800, var(--accent));
}

.ds-rating__button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- Rating`
Expected: PASS (2 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/Rating.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rating } from '@design-system/react/components/molecules/Rating';

const meta = {
  title: 'Components/Rating',
  component: Rating,
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadOnly: Story = {
  args: { value: 4 },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState(3);
    return <Rating value={value} onValueChange={setValue} />;
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/molecules/Rating.tsx packages/react/src/components/molecules/Rating.test.tsx packages/react/src/styles.css apps/storybook/src/stories/Rating.stories.tsx
git commit -m "feat(react): add Rating molecule"
```

---

## Task 14: Install TanStack dependencies and add VirtualList organism

**Files:**

- Modify: `packages/react/package.json` (add dependencies)
- Create: `packages/react/src/components/organisms/VirtualList.tsx`
- Test: `packages/react/src/components/organisms/VirtualList.test.tsx`
- Story: `apps/storybook/src/stories/VirtualList.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `VirtualList<T>` — `{ items: T[]; estimateSize: (index: number) => number; renderItem: (item: T, index: number) => ReactNode; height: number }`. Consumed by `Combobox` (Task 18) for long option lists and `Table` (Task 19) for large row sets.

- [ ] **Step 1: Install `@tanstack/react-virtual`**

```bash
pnpm --filter @elirobinson/react add @tanstack/react-virtual
```

Run: `pnpm sync:deps`
Expected: lockfile stays in sync, no errors.

- [ ] **Step 2: Write the failing test**

```tsx
// packages/react/src/components/organisms/VirtualList.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VirtualList } from './VirtualList';

describe('VirtualList', () => {
  it('renders visible items via renderItem', () => {
    const items = Array.from({ length: 50 }, (_, index) => `Item ${index}`);

    render(
      <VirtualList
        items={items}
        estimateSize={() => 32}
        height={300}
        renderItem={(item) => <div key={item}>{item}</div>}
      />,
    );

    expect(screen.getByText('Item 0')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- VirtualList`
Expected: FAIL — `./VirtualList` module not found.

- [ ] **Step 4: Implement VirtualList**

```tsx
// packages/react/src/components/organisms/VirtualList.tsx
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from '../../lib/cn';

export type VirtualListProps<T> = {
  items: T[];
  estimateSize: (index: number) => number;
  renderItem: (item: T, index: number) => ReactNode;
  height: number;
  className?: string;
};

export function VirtualList<T>({
  items,
  estimateSize,
  renderItem,
  height,
  className,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
  });

  return (
    <div
      ref={parentRef}
      className={cn('ds-virtual-list', className)}
      style={{ height, overflow: 'auto' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            className="ds-virtual-list__row"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add styles**

```css
.ds-virtual-list {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.ds-virtual-list__row {
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--border);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- VirtualList`
Expected: PASS (1 test). Note: `@tanstack/react-virtual` requires a real scroll-container size; if jsdom returns 0 for the container height in the test environment, the virtualizer still renders at least the overscan items — if this test fails because nothing renders, add `Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 300 })` at the top of the test file as a jsdom workaround.

- [ ] **Step 7: Add Storybook story**

```tsx
// apps/storybook/src/stories/VirtualList.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { VirtualList } from '@design-system/react/components/organisms/VirtualList';

const meta = {
  title: 'Components/VirtualList',
  component: VirtualList,
} satisfies Meta<typeof VirtualList>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = Array.from({ length: 1000 }, (_, index) => `Row ${index + 1}`);

export const Default: Story = {
  render: () => (
    <VirtualList
      items={items}
      estimateSize={() => 40}
      height={320}
      renderItem={(item) => <span>{item}</span>}
    />
  ),
};
```

- [ ] **Step 8: Commit**

```bash
git add packages/react/package.json pnpm-lock.yaml packages/react/src/components/organisms/VirtualList.tsx packages/react/src/components/organisms/VirtualList.test.tsx packages/react/src/styles.css apps/storybook/src/stories/VirtualList.stories.tsx
git commit -m "feat(react): add VirtualList organism backed by @tanstack/react-virtual"
```

---

## Task 15: Install @tanstack/react-form and add useDsForm hook

**Files:**

- Modify: `packages/react/package.json`
- Create: `packages/react/src/hooks/useDsForm.ts`
- Test: `packages/react/src/hooks/useDsForm.test.tsx`

**Interfaces:**

- Produces: `useDsForm<T>(options)` — thin re-export/wrapper around `@tanstack/react-form`'s `useForm`, giving consumers a single import path (`@elirobinson/react/hooks/useDsForm`) instead of depending on TanStack directly. `FormField` (Task 7) remains usable standalone without this hook.

- [ ] **Step 1: Install `@tanstack/react-form`**

```bash
pnpm --filter @elirobinson/react add @tanstack/react-form
```

Run: `pnpm sync:deps`
Expected: lockfile stays in sync, no errors.

- [ ] **Step 2: Write the failing test**

```tsx
// packages/react/src/hooks/useDsForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useDsForm } from './useDsForm';

function TestForm({ onSubmit }: { onSubmit: (value: string) => void }) {
  const form = useDsForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => onSubmit(value.email),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <input
            aria-label="Email"
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
      <button type="submit">Submit</button>
    </form>
  );
}

describe('useDsForm', () => {
  it('submits the current field value', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<TestForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'a@b.com');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith('a@b.com');
  });
});
```

Add `import { vi } from 'vitest';` alongside the other vitest imports at the top of the file.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- useDsForm`
Expected: FAIL — `./useDsForm` module not found.

- [ ] **Step 4: Implement useDsForm**

```ts
// packages/react/src/hooks/useDsForm.ts
import { useForm } from '@tanstack/react-form';

export const useDsForm = useForm;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- useDsForm`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add packages/react/package.json pnpm-lock.yaml packages/react/src/hooks/useDsForm.ts packages/react/src/hooks/useDsForm.test.tsx
git commit -m "feat(react): add useDsForm hook backed by @tanstack/react-form"
```

---

## Task 16: Add Accordion organism

**Files:**

- Create: `packages/react/src/components/organisms/Accordion.tsx`
- Test: `packages/react/src/components/organisms/Accordion.test.tsx`
- Story: `apps/storybook/src/stories/Accordion.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` — same context-provider compound pattern as `Tabs` (`organisms/Tabs.tsx`). `type="single" | "multiple"` controls whether opening one item closes the others.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/organisms/Accordion.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './Accordion';

function Example() {
  return (
    <Accordion type="single">
      <AccordionItem value="a">
        <AccordionTrigger>Section A</AccordionTrigger>
        <AccordionContent>Content A</AccordionContent>
      </AccordionItem>
      <AccordionItem value="b">
        <AccordionTrigger>Section B</AccordionTrigger>
        <AccordionContent>Content B</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

describe('Accordion', () => {
  it('starts with all sections collapsed', () => {
    render(<Example />);
    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
  });

  it('expands a section when its trigger is clicked', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole('button', { name: 'Section A' }));

    expect(screen.getByText('Content A')).toBeInTheDocument();
  });

  it('collapses the previously open section in single mode', async () => {
    const user = userEvent.setup();
    render(<Example />);

    await user.click(screen.getByRole('button', { name: 'Section A' }));
    await user.click(screen.getByRole('button', { name: 'Section B' }));

    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(screen.getByText('Content B')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- Accordion`
Expected: FAIL — `./Accordion` module not found.

- [ ] **Step 3: Implement Accordion**

```tsx
// packages/react/src/components/organisms/Accordion.tsx
import type { HTMLAttributes } from 'react';
import { createContext, useContext, useId, useState } from 'react';

import { cn } from '../../lib/cn';

type AccordionContextValue = {
  openValues: string[];
  toggle: (value: string) => void;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion compound components must be used within Accordion');
  }
  return context;
}

const AccordionItemContext = createContext<{ value: string; baseId: string } | null>(null);

function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error('AccordionTrigger/AccordionContent must be used within AccordionItem');
  }
  return context;
}

export type AccordionProps = HTMLAttributes<HTMLDivElement> & {
  type?: 'single' | 'multiple';
};

export function Accordion({ className, type = 'single', children, ...props }: AccordionProps) {
  const [openValues, setOpenValues] = useState<string[]>([]);

  const toggle = (value: string) => {
    setOpenValues((current) => {
      const isOpen = current.includes(value);
      if (type === 'single') {
        return isOpen ? [] : [value];
      }
      return isOpen ? current.filter((item) => item !== value) : [...current, value];
    });
  };

  return (
    <AccordionContext.Provider value={{ openValues, toggle }}>
      <div className={cn('ds-accordion', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export type AccordionItemProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export function AccordionItem({ className, value, children, ...props }: AccordionItemProps) {
  const baseId = useId();

  return (
    <AccordionItemContext.Provider value={{ value, baseId }}>
      <div className={cn('ds-accordion__item', className)} {...props}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export type AccordionTriggerProps = HTMLAttributes<HTMLButtonElement>;

export function AccordionTrigger({ className, children, ...props }: AccordionTriggerProps) {
  const { openValues, toggle } = useAccordionContext();
  const { value, baseId } = useAccordionItemContext();
  const isOpen = openValues.includes(value);

  return (
    <button
      type="button"
      id={`${baseId}-trigger`}
      aria-expanded={isOpen}
      aria-controls={`${baseId}-content`}
      className={cn('ds-accordion__trigger', isOpen && 'ds-accordion__trigger--open', className)}
      onClick={() => toggle(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export type AccordionContentProps = HTMLAttributes<HTMLDivElement>;

export function AccordionContent({ className, children, ...props }: AccordionContentProps) {
  const { openValues } = useAccordionContext();
  const { value, baseId } = useAccordionItemContext();
  const isOpen = openValues.includes(value);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      id={`${baseId}-content`}
      role="region"
      aria-labelledby={`${baseId}-trigger`}
      className={cn('ds-accordion__content', className)}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

```css
.ds-accordion {
  border-top: 1px solid var(--border);
}

.ds-accordion__item {
  border-bottom: 1px solid var(--border);
}

.ds-accordion__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  padding: var(--space-3) 0;
  border: none;
  background: transparent;
  color: var(--fg);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
  text-align: left;
  cursor: pointer;
}

.ds-accordion__trigger::after {
  content: '+';
  color: var(--fg-3);
}

.ds-accordion__trigger--open::after {
  content: '−';
}

.ds-accordion__trigger:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.ds-accordion__content {
  padding-bottom: var(--space-3);
  color: var(--fg-2);
  font-size: var(--fs-sm);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- Accordion`
Expected: PASS (3 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/Accordion.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@design-system/react/components/organisms/Accordion';

const meta = {
  title: 'Components/Accordion',
  component: Accordion,
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Accordion type="single">
      <AccordionItem value="shipping">
        <AccordionTrigger>Shipping</AccordionTrigger>
        <AccordionContent>Orders ship within 2 business days.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="returns">
        <AccordionTrigger>Returns</AccordionTrigger>
        <AccordionContent>Returns accepted within 30 days.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/organisms/Accordion.tsx packages/react/src/components/organisms/Accordion.test.tsx packages/react/src/styles.css apps/storybook/src/stories/Accordion.stories.tsx
git commit -m "feat(react): add Accordion organism"
```

---

## Task 17: Add DatePicker organism

**Files:**

- Create: `packages/react/src/components/organisms/DatePicker.tsx`
- Test: `packages/react/src/components/organisms/DatePicker.test.tsx`
- Story: `apps/storybook/src/stories/DatePicker.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Consumes: `Popover` (`./Popover`), `useAnchoredPosition`/`useClickOutside` pattern already used by `Popover`/`Select`, `Input` (`../atoms/Input`).
- Produces: `DatePicker` — `{ value?: Date; onValueChange: (date: Date) => void; label: string }`. Uses native `Date` only, no date library.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/organisms/DatePicker.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from './DatePicker';

describe('DatePicker', () => {
  it('opens the calendar when the input is clicked', async () => {
    const user = userEvent.setup();
    render(<DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={vi.fn()} />);

    await user.click(screen.getByLabelText('Start date'));

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('calls onValueChange with the clicked day and closes the calendar', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <DatePicker label="Start date" value={new Date(2026, 0, 15)} onValueChange={onValueChange} />,
    );
    await user.click(screen.getByLabelText('Start date'));
    await user.click(screen.getByRole('button', { name: '20' }));

    expect(onValueChange).toHaveBeenCalledWith(new Date(2026, 0, 20));
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- DatePicker`
Expected: FAIL — `./DatePicker` module not found.

- [ ] **Step 3: Implement DatePicker**

```tsx
// packages/react/src/components/organisms/DatePicker.tsx
import { useState } from 'react';

import { cn } from '../../lib/cn';
import { Input } from '../atoms/Input';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useRef } from 'react';

export type DatePickerProps = {
  label: string;
  value?: Date;
  onValueChange: (date: Date) => void;
  className?: string;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatValue(date: Date | undefined) {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function DatePicker({ label, value, onValueChange, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, index) => index + 1);
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, index) => index);

  return (
    <div ref={containerRef} className={cn('ds-date-picker', className)}>
      <Input
        aria-label={label}
        readOnly
        value={formatValue(value)}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen ? (
        <div className="ds-date-picker__popover">
          <div className="ds-date-picker__header">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
            >
              ‹
            </button>
            <span>{viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
            >
              ›
            </button>
          </div>
          <div role="grid" className="ds-date-picker__grid">
            {leadingBlanks.map((blank) => (
              <span key={`blank-${blank}`} />
            ))}
            {days.map((day) => (
              <button
                key={day}
                type="button"
                className="ds-date-picker__day"
                onClick={() => {
                  onValueChange(new Date(year, month, day));
                  setIsOpen(false);
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

```css
.ds-date-picker {
  position: relative;
  display: inline-block;
}

.ds-date-picker__popover {
  position: absolute;
  z-index: var(--z-toast, 50);
  margin-top: var(--space-1);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  width: 280px;
}

.ds-date-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-medium);
}

.ds-date-picker__header button {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: var(--fs-md);
  color: var(--fg-2);
}

.ds-date-picker__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.ds-date-picker__day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--fg);
  font-size: var(--fs-xs);
  cursor: pointer;
}

.ds-date-picker__day:hover {
  background: var(--bg-subtle);
}

.ds-date-picker__day:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- DatePicker`
Expected: PASS (2 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/DatePicker.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DatePicker } from '@design-system/react/components/organisms/DatePicker';

const meta = {
  title: 'Components/DatePicker',
  component: DatePicker,
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>(new Date());
    return <DatePicker label="Start date" value={value} onValueChange={setValue} />;
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/organisms/DatePicker.tsx packages/react/src/components/organisms/DatePicker.test.tsx packages/react/src/styles.css apps/storybook/src/stories/DatePicker.stories.tsx
git commit -m "feat(react): add DatePicker organism"
```

---

## Task 18: Add Combobox organism

**Files:**

- Create: `packages/react/src/components/organisms/Combobox.tsx`
- Test: `packages/react/src/components/organisms/Combobox.test.tsx`
- Story: `apps/storybook/src/stories/Combobox.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Consumes: `SearchField` (`../molecules/SearchField`), `useClickOutside` (`../../hooks/useClickOutside`).
- Produces: `Combobox` — `{ options: { label: string; value: string }[]; value?: string; onValueChange: (value: string) => void; label: string }`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/organisms/Combobox.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Combobox } from './Combobox';

const options = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
];

describe('Combobox', () => {
  it('filters options as the user types', async () => {
    const user = userEvent.setup();
    render(<Combobox label="Fruit" options={options} onValueChange={vi.fn()} />);

    await user.click(screen.getByLabelText('Fruit'));
    await user.type(screen.getByLabelText('Fruit'), 'ba');

    expect(screen.getByRole('option', { name: 'Banana' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Apple' })).not.toBeInTheDocument();
  });

  it('calls onValueChange when an option is selected', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(<Combobox label="Fruit" options={options} onValueChange={onValueChange} />);
    await user.click(screen.getByLabelText('Fruit'));
    await user.click(screen.getByRole('option', { name: 'Cherry' }));

    expect(onValueChange).toHaveBeenCalledWith('cherry');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- Combobox`
Expected: FAIL — `./Combobox` module not found.

- [ ] **Step 3: Implement Combobox**

```tsx
// packages/react/src/components/organisms/Combobox.tsx
import { useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { useClickOutside } from '../../hooks/useClickOutside';
import { SearchField } from '../molecules/SearchField';

export type ComboboxOption = {
  label: string;
  value: string;
};

export type ComboboxProps = {
  label: string;
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export function Combobox({ label, options, value, onValueChange, className }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div ref={containerRef} className={cn('ds-combobox', className)}>
      <SearchField
        aria-label={label}
        role="combobox"
        aria-expanded={isOpen}
        value={isOpen ? query : selectedLabel}
        onValueChange={(next) => {
          setQuery(next);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen ? (
        <ul role="listbox" className="ds-combobox__list">
          {filtered.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className="ds-combobox__option"
                onClick={() => {
                  onValueChange(option.value);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="ds-combobox__empty">No matches</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

```css
.ds-combobox {
  position: relative;
  width: 100%;
}

.ds-combobox__list {
  position: absolute;
  z-index: var(--z-toast, 50);
  margin: var(--space-1) 0 0;
  padding: var(--space-1) 0;
  list-style: none;
  width: 100%;
  max-height: 240px;
  overflow-y: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.ds-combobox__option {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: none;
  background: transparent;
  color: var(--fg);
  font-size: var(--fs-sm);
  text-align: left;
  cursor: pointer;
}

.ds-combobox__option:hover,
.ds-combobox__option[aria-selected='true'] {
  background: var(--bg-subtle);
}

.ds-combobox__empty {
  padding: var(--space-3);
  color: var(--fg-3);
  font-size: var(--fs-sm);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- Combobox`
Expected: PASS (2 tests).

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/Combobox.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Combobox } from '@design-system/react/components/organisms/Combobox';

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string | undefined>();
    return (
      <Combobox
        label="Fruit"
        options={[
          { label: 'Apple', value: 'apple' },
          { label: 'Banana', value: 'banana' },
          { label: 'Cherry', value: 'cherry' },
        ]}
        value={value}
        onValueChange={setValue}
      />
    );
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/organisms/Combobox.tsx packages/react/src/components/organisms/Combobox.test.tsx packages/react/src/styles.css apps/storybook/src/stories/Combobox.stories.tsx
git commit -m "feat(react): add Combobox organism"
```

---

## Task 19: Add Table organism

**Files:**

- Create: `packages/react/src/components/organisms/Table.tsx`
- Test: `packages/react/src/components/organisms/Table.test.tsx`
- Story: `apps/storybook/src/stories/Table.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Consumes: `@tanstack/react-table`'s `useReactTable`/`getCoreRowModel`, `Pagination` (`../molecules/Pagination`), `EmptyState` (`../molecules/EmptyState`).
- Produces: `Table<T>` — `{ data: T[]; columns: ColumnDef<T>[]; pageSize?: number; emptyMessage?: string }`.

- [ ] **Step 1: Install `@tanstack/react-table`**

```bash
pnpm --filter @elirobinson/react add @tanstack/react-table
```

Run: `pnpm sync:deps`
Expected: lockfile stays in sync, no errors.

- [ ] **Step 2: Write the failing test**

```tsx
// packages/react/src/components/organisms/Table.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';

import { Table } from './Table';

type Row = { id: number; name: string };

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

describe('Table', () => {
  it('renders column headers and row data', () => {
    render(<Table data={[{ id: 1, name: 'Ada' }]} columns={columns} />);

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
  });

  it('renders EmptyState when there is no data', () => {
    render(<Table data={[]} columns={columns} emptyMessage="No rows yet" />);

    expect(screen.getByText('No rows yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- Table`
Expected: FAIL — `./Table` module not found.

- [ ] **Step 4: Implement Table**

```tsx
// packages/react/src/components/organisms/Table.tsx
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

import { cn } from '../../lib/cn';
import { EmptyState } from '../molecules/EmptyState';
import { Pagination } from '../molecules/Pagination';

export type TableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  emptyMessage?: string;
  className?: string;
};

export function Table<T>({
  data,
  columns,
  pageSize = 10,
  emptyMessage = 'No results',
  className,
}: TableProps<T>) {
  const [page, setPage] = useState(1);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  const rows = table.getRowModel().rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className={cn('ds-table-wrapper', className)}>
      <table className="ds-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pageCount > 1 ? (
        <div className="ds-table-wrapper__footer">
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Add styles**

```css
.ds-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  overflow-x: auto;
}

.ds-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}

.ds-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-strong);
  color: var(--fg-2);
  font-weight: var(--fw-medium);
}

.ds-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  color: var(--fg);
}

.ds-table-wrapper__footer {
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- Table`
Expected: PASS (2 tests).

- [ ] **Step 7: Add Storybook story**

```tsx
// apps/storybook/src/stories/Table.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnDef } from '@tanstack/react-table';
import { Table } from '@design-system/react/components/organisms/Table';

type Row = { id: number; name: string; role: string };

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
];

const data: Row[] = Array.from({ length: 25 }, (_, index) => ({
  id: index + 1,
  name: `User ${index + 1}`,
  role: index % 2 === 0 ? 'Admin' : 'Member',
}));

const meta = {
  title: 'Components/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { data, columns, pageSize: 10 },
};

export const Empty: Story = {
  args: { data: [], columns, emptyMessage: 'No users yet' },
};
```

- [ ] **Step 8: Commit**

```bash
git add packages/react/package.json pnpm-lock.yaml packages/react/src/components/organisms/Table.tsx packages/react/src/components/organisms/Table.test.tsx packages/react/src/styles.css apps/storybook/src/stories/Table.stories.tsx
git commit -m "feat(react): add Table organism backed by @tanstack/react-table"
```

---

## Task 20: Add NavigationMenu organism

**Files:**

- Create: `packages/react/src/components/organisms/NavigationMenu.tsx`
- Story: `apps/storybook/src/stories/NavigationMenu.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Produces: `NavigationMenu` — `{ items: NavigationMenuItem[]; currentPath?: string }`, `NavigationMenuItem = { label: string; href: string; items?: NavigationMenuItem[] }`. This is the nav-item-list primitive referenced in `docs/agents/layout-patterns.md` — the app-specific `Header`/`Sidebar` layout compositions render this internally rather than duplicating nav-list markup. No test file (presentational, recursion is straightforward — consistent with `Breadcrumb`).

- [ ] **Step 1: Implement NavigationMenu**

```tsx
// packages/react/src/components/organisms/NavigationMenu.tsx
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export type NavigationMenuItem = {
  label: string;
  href: string;
  items?: NavigationMenuItem[];
};

export type NavigationMenuProps = HTMLAttributes<HTMLElement> & {
  items: NavigationMenuItem[];
  currentPath?: string;
};

function NavigationMenuList({
  items,
  currentPath,
}: {
  items: NavigationMenuItem[];
  currentPath?: string;
}) {
  return (
    <ul className="ds-navigation-menu__list">
      {items.map((item) => {
        const isActive = item.href === currentPath;
        return (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'ds-navigation-menu__link',
                isActive && 'ds-navigation-menu__link--active',
              )}
            >
              {item.label}
            </a>
            {item.items ? (
              <NavigationMenuList items={item.items} currentPath={currentPath} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function NavigationMenu({ className, items, currentPath, ...props }: NavigationMenuProps) {
  return (
    <nav className={cn('ds-navigation-menu', className)} {...props}>
      <NavigationMenuList items={items} currentPath={currentPath} />
    </nav>
  );
}
```

- [ ] **Step 2: Add styles**

```css
.ds-navigation-menu__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.ds-navigation-menu__list .ds-navigation-menu__list {
  padding-left: var(--space-4);
}

.ds-navigation-menu__link {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--fg-2);
  font-size: var(--fs-sm);
  text-decoration: none;
}

.ds-navigation-menu__link:hover {
  background: var(--bg-subtle);
  color: var(--fg);
}

.ds-navigation-menu__link--active {
  background: var(--bg-subtle);
  color: var(--fg);
  font-weight: var(--fw-medium);
}

.ds-navigation-menu__link:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @elirobinson/react build`
Expected: builds with no TypeScript errors.

- [ ] **Step 4: Add Storybook story**

```tsx
// apps/storybook/src/stories/NavigationMenu.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { NavigationMenu } from '@design-system/react/components/organisms/NavigationMenu';

const meta = {
  title: 'Components/NavigationMenu',
  component: NavigationMenu,
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentPath: '/settings/profile',
    items: [
      { label: 'Dashboard', href: '/' },
      {
        label: 'Settings',
        href: '/settings',
        items: [
          { label: 'Profile', href: '/settings/profile' },
          { label: 'Billing', href: '/settings/billing' },
        ],
      },
    ],
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/components/organisms/NavigationMenu.tsx packages/react/src/styles.css apps/storybook/src/stories/NavigationMenu.stories.tsx
git commit -m "feat(react): add NavigationMenu organism"
```

---

## Task 21: Add CommandPalette organism

**Files:**

- Create: `packages/react/src/components/organisms/CommandPalette.tsx`
- Test: `packages/react/src/components/organisms/CommandPalette.test.tsx`
- Story: `apps/storybook/src/stories/CommandPalette.stories.tsx`
- Modify: `packages/react/src/styles.css`

**Interfaces:**

- Consumes: `Dialog` (`./Dialog`), `SearchField` (`../molecules/SearchField`), `Kbd` (`../atoms/Kbd`).
- Produces: `CommandPalette` — `{ isOpen: boolean; onOpenChange: (open: boolean) => void; commands: { id: string; label: string; shortcut?: string[]; onSelect: () => void }[] }`. Consumers wire their own global `Cmd+K` listener and pass `isOpen`/`onOpenChange`; this component only renders the palette itself.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/src/components/organisms/CommandPalette.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CommandPalette } from './CommandPalette';

const commands = [
  { id: 'new', label: 'New file', onSelect: vi.fn() },
  { id: 'open', label: 'Open file', onSelect: vi.fn() },
];

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    render(<CommandPalette isOpen={false} onOpenChange={vi.fn()} commands={commands} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('filters commands by search text', async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen onOpenChange={vi.fn()} commands={commands} />);

    await user.type(screen.getByRole('searchbox'), 'new');

    expect(screen.getByText('New file')).toBeInTheDocument();
    expect(screen.queryByText('Open file')).not.toBeInTheDocument();
  });

  it('calls onSelect and closes when a command is chosen', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    const customCommands = [{ id: 'new', label: 'New file', onSelect }];

    render(<CommandPalette isOpen onOpenChange={onOpenChange} commands={customCommands} />);
    await user.click(screen.getByText('New file'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @elirobinson/react test -- CommandPalette`
Expected: FAIL — `./CommandPalette` module not found.

- [ ] **Step 3: Implement CommandPalette**

Check `organisms/Dialog.tsx`'s exact exported prop names (`open`/`onOpenChange` vs. similar) before writing this file — mirror whatever it already uses rather than guessing, since `Dialog` is being reused here as-is.

```tsx
// packages/react/src/components/organisms/CommandPalette.tsx
import { useState } from 'react';

import { cn } from '../../lib/cn';
import { Kbd } from '../atoms/Kbd';
import { SearchField } from '../molecules/SearchField';
import { Dialog } from './Dialog';

export type CommandPaletteCommand = {
  id: string;
  label: string;
  shortcut?: string[];
  onSelect: () => void;
};

export type CommandPaletteProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  commands: CommandPaletteCommand[];
  className?: string;
};

export function CommandPalette({ isOpen, onOpenChange, commands, className }: CommandPaletteProps) {
  const [query, setQuery] = useState('');

  if (!isOpen) {
    return null;
  }

  const filtered = commands.filter((command) =>
    command.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <div className={cn('ds-command-palette', className)}>
        <SearchField
          aria-label="Search commands"
          value={query}
          onValueChange={setQuery}
          autoFocus
        />
        <ul className="ds-command-palette__list">
          {filtered.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                className="ds-command-palette__item"
                onClick={() => {
                  command.onSelect();
                  onOpenChange(false);
                }}
              >
                <span>{command.label}</span>
                {command.shortcut ? (
                  <span className="ds-command-palette__shortcut">
                    {command.shortcut.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="ds-command-palette__empty">No matching commands</li>
          ) : null}
        </ul>
      </div>
    </Dialog>
  );
}
```

**Note for the implementer:** if `Dialog`'s actual prop names differ from `open`/`onOpenChange` (e.g. it's uncontrolled, or uses `isOpen`), adjust the two call sites above (the `<Dialog ...>` JSX and nothing else) to match — everything else in this component is independent of that choice.

- [ ] **Step 4: Add styles**

```css
.ds-command-palette {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 480px;
  max-width: 90vw;
}

.ds-command-palette__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
}

.ds-command-palette__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--fg);
  font-size: var(--fs-sm);
  cursor: pointer;
  text-align: left;
}

.ds-command-palette__item:hover {
  background: var(--bg-subtle);
}

.ds-command-palette__shortcut {
  display: flex;
  gap: 4px;
}

.ds-command-palette__empty {
  padding: var(--space-3);
  color: var(--fg-3);
  font-size: var(--fs-sm);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @elirobinson/react test -- CommandPalette`
Expected: PASS (3 tests). If `Dialog` renders via a portal that Testing Library can't find with `getByRole('dialog')`, check `Dialog.test.tsx` (moved to `organisms/Dialog.test.tsx` in Task 1) for the query pattern it already uses and match it.

- [ ] **Step 6: Add Storybook story**

```tsx
// apps/storybook/src/stories/CommandPalette.stories.tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandPalette } from '@design-system/react/components/organisms/CommandPalette';

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);
    return (
      <CommandPalette
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        commands={[
          { id: 'new', label: 'New file', shortcut: ['⌘', 'N'], onSelect: () => {} },
          { id: 'open', label: 'Open file', shortcut: ['⌘', 'O'], onSelect: () => {} },
          { id: 'save', label: 'Save', shortcut: ['⌘', 'S'], onSelect: () => {} },
        ]}
      />
    );
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/organisms/CommandPalette.tsx packages/react/src/components/organisms/CommandPalette.test.tsx packages/react/src/styles.css apps/storybook/src/stories/CommandPalette.stories.tsx
git commit -m "feat(react): add CommandPalette organism"
```

---

## Task 22: Update documentation and publish

**Files:**

- Modify: `docs/agents/components.md`
- Modify: `packages/react/package.json` (changeset)

**Interfaces:** none — documentation and release bookkeeping only.

- [ ] **Step 1: Update the shadcn mapping table**

In `docs/agents/components.md`, extend the "shadcn → Miltinson mapping reference" table (or add a new "New components" table below it) documenting the 19 additions from this plan with a one-line description each, mirroring the existing table's format.

- [ ] **Step 2: Add a changeset**

Run: `pnpm changeset`
Select `@elirobinson/react`, choose `minor` (net-new components, no breaking changes to existing exports besides the import-path move — see Step 3), and write a summary describing the atomic reorg + 19 new components.

- [ ] **Step 3: Note the breaking import-path change**

Because Task 1 changes every existing import path (`components/Button` → `components/atoms/Button`), this is actually a **breaking change** for existing consumers (including the user's Next.js template). Re-run `pnpm changeset` if needed and select `major` instead of `minor` for `@elirobinson/react`, and add a short migration note to the changeset body: "Import paths now include the atomic tier, e.g. `@elirobinson/react/components/Button` → `@elirobinson/react/components/atoms/Button`. See `docs/agents/components.md` for the full tier mapping."

- [ ] **Step 4: Run full verification**

Run: `pnpm build && pnpm test && pnpm lint && pnpm typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add docs/agents/components.md .changeset
git commit -m "docs(react): document new components and atomic tier import paths"
```

---

## Self-Review Notes

- **Spec coverage:** All four spec sections are covered — Section A (Task 1), Section B (Tasks 2–21, all 19 new components + 24 recategorized), Section C (Tasks 14, 15, 19), Section D phase ordering (task order follows Phase 0 → 1 → 2 → 3 → 4 exactly).
- **Cross-task dependencies:** `FormField` (Task 7) is consumed conceptually by `SearchField`/`Combobox`'s `aria-describedby` pattern; `SearchField` (Task 8) is consumed by `Combobox` (Task 18); `VirtualList` (Task 14) is available to `Table`/`Combobox` but not wired in by default (both ship without virtualization to keep the base implementation simple — wiring virtualization into `Table`/`Combobox` for very large datasets is a natural follow-up, not required by the spec); `Pagination` (Task 9) and `EmptyState` (Task 12) are consumed directly by `Table` (Task 19); `Dialog` is reused as-is by `CommandPalette` (Task 21).
- **Breaking change flagged explicitly** in Task 22 since Task 1's import-path change affects the user's already-adopted Next.js template.
