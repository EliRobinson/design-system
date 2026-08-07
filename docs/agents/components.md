# Components

## Component adoption order

When bringing an app onto the design system:

1. Replace primitive `button`, `input`, and card wrappers with `@elirobinson/react`.
2. Move style values to CSS custom properties from tokens.
3. Keep all interactions keyboard accessible and focus-visible compliant.

## shadcn component adoption

When pulling a new component from [shadcn/ui](https://ui.shadcn.com/), **do not install Tailwind or copy shadcn styles verbatim**. Instead:

1. **Use shadcn for API shape and accessibility patterns** — prop names, compound subcomponents (e.g. `CardHeader`, `DialogContent`), ARIA roles, keyboard behavior, and focus management.
2. **Style against Miltinson tokens** — every visual value must come from `@elirobinson/tokens/tokens.css` via `ds-*` classes in `packages/react/src/styles.css`.
3. **Match brand preview swatches** — check `design-system-docs/preview/` for the canonical look of buttons, fields, cards, tags, and layout patterns before styling.
4. **Follow existing conventions** — `ds-` prefix for classes, `forwardRef` for interactive elements, 44px minimum touch targets, visible `:focus-visible` rings using `--focus-ring`.
5. **Export from `@elirobinson/react`** — add the component under `packages/react/src/components/<tier>/` (consumers import `@elirobinson/react/components/<tier>/<Name>`) and a Storybook story in `apps/storybook/`.
6. **Skip Radix/Tailwind dependencies** unless explicitly requested — implement with native HTML elements and React state, styled with token CSS.

## Atomic tiers

Components live under `packages/react/src/components/<tier>/`:

- **atoms/** — single-purpose, not further divisible (e.g. `Button`, `Input`).
- **molecules/** — a few atoms combined into one functional unit, no portal/overlay orchestration (e.g. `Card`, `Alert`).
- **organisms/** — compound components with internal state and/or overlay orchestration: portals, focus trapping, keyboard nav (e.g. `Dialog`, `Select`).

Boundary rule: if a component renders into a portal, traps focus, or manages open/closed state across multiple sub-elements, it's an organism. If it's assembled from 2+ atoms with no such orchestration, it's a molecule. Otherwise it's an atom.

Import via the tiered subpath: `@elirobinson/react/components/<tier>/<Name>`.

### Constraints (all components, all tiers)

- Every component that renders a focusable/interactive native element uses `forwardRef`, forwarding to the outermost interactive/native element the component owns.
- Touch targets are scoped by control role, not one blanket size:
  - **Primary interactive controls** — buttons, pagination items, segmented-control options, nav items, and other button-like controls — have a minimum 44x44 touch target. Where visual density matters, keep the painted glyph small and expand the hit area (padding, or a bounded overlay) rather than inflating the visible control.
  - **Dense inline affordances** — a chip's remove glyph, a search field's clear button, rating stars, calendar day cells — follow shadcn/MUI-scale sizing instead, not 44px. Reference values: MUI Chip is 32px tall (24px `small`) with a 22px (16px `small`) delete icon; shadcn Badge is ~20px tall with 12px icons and ships no remove affordance at all.
  - **In both cases**, an expanded hit area must never overlap sibling content. A 44x44 overlay on a chip once covered the chip's own label, so clicking the label's tail fired the remove handler — bound the hit area (e.g. stretch to the container's height, not a symmetric negative inset) so this can't recur.

### FormField vs Input

- **`Input`** (`atoms/Input`) is the batteries-included labelled control: it requires a
  `label` prop and renders its own `<label>`, hint, error text, and `aria-describedby`/
  `aria-invalid` wiring. Reach for it whenever the control is a plain `<input>`.
- **`FormField`** (`molecules/FormField`) wraps an arbitrary or third-party control that
  does not do its own label/hint/error wiring. It owns the `<label>` and message markup
  and hands the child a render-prop bundle (`aria-describedby`, `aria-invalid`,
  `aria-required`) to spread onto that control. Do not nest `Input` inside `FormField` —
  `Input` already renders its own label and message region, so wrapping it produces
  duplicate labels.

## New components (component library expansion)

19 components and one hook were added in this expansion. Import components via
the tiered subpath (`@elirobinson/react/components/<tier>/<Name>`, see above);
import the hook via `@elirobinson/react/hooks/useDsForm`.

| Component                       | Tier      | Notes                                                                                                                                                                                                                                                          |
| ------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RadioGroup` / `RadioGroupItem` | atoms     | Context-based radio group; `RadioGroupItemProps` omits `checked`/`onChange`/`name` since the group owns them.                                                                                                                                                  |
| `Spinner`                       | atoms     | `role="status"` loading indicator; `size` (`sm`/`md`/`lg`) and `label` (default `"Loading"`).                                                                                                                                                                  |
| `Slider`                        | atoms     | Labelled native `<input type="range">`; `label` is required, matching `Input`/`Textarea`/`Select`.                                                                                                                                                             |
| `Kbd`                           | atoms     | Styled `<kbd>` for keyboard-shortcut hints; used by `CommandPalette`.                                                                                                                                                                                          |
| `Chip`                          | molecules | Optional `onRemove` renders a dense inline remove button sized to the shadcn/MUI scale, not 44px — see Constraints above.                                                                                                                                      |
| `FormField`                     | molecules | See "FormField vs Input" above.                                                                                                                                                                                                                                |
| `SearchField`                   | molecules | `type="search"` input with a built-in clear button; `value`/`onValueChange` (controlled) or `defaultValue` (uncontrolled).                                                                                                                                     |
| `Pagination`                    | molecules | `page`/`pageCount`/`onPageChange`; renders one button per page — no windowing for very large page counts (fine for typical use, flagged as a follow-up for 100+ pages).                                                                                        |
| `Stepper`                       | molecules | `steps` (`{ label }[]`) + `activeStep`; ordered-list progress indicator.                                                                                                                                                                                       |
| `SegmentedControl`              | molecules | `role="radiogroup"`/`role="radio"` option group with roving-tabindex arrow-key navigation; a primary control, so it keeps the 44px touch target.                                                                                                               |
| `EmptyState`                    | molecules | `title` + optional `description`/`icon`/`action`; used by `Table`'s empty-rows branch.                                                                                                                                                                         |
| `Rating`                        | molecules | Read-only (`role="img"`) when `onValueChange` is omitted; interactive star buttons otherwise (dense inline sizing, not 44px).                                                                                                                                  |
| `VirtualList`                   | organisms | Generic windowed list wrapping `@tanstack/react-virtual`; `items`/`estimateSize`/`renderItem`/`height`/`overscan`. Composed by `Table` (`virtualize` prop) and `Combobox`.                                                                                     |
| `Accordion`                     | organisms | Compound `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`; `headingLevel` (1-6, default 3) with a runtime fallback for out-of-range values.                                                                                                   |
| `DatePicker`                    | organisms | Popover date grid (`role="grid"`/`row`/`gridcell`, dense day-cell sizing); `label` required, `value`/`onValueChange`.                                                                                                                                          |
| `Combobox`                      | organisms | Filterable single-select combobox following the WAI-ARIA combobox-with-listbox-popup pattern; its option list is windowed via `VirtualList` once open.                                                                                                         |
| `Table`                         | organisms | Built on `@tanstack/react-table`'s row models (not hand-rolled pagination). `data`/`columns` (`ColumnDef<T>`, re-exported from this module); opt-in `virtualize` prop swaps the paginated `<table>` for a windowed ARIA `role="table"` grid via `VirtualList`. |
| `NavigationMenu`                | organisms | Always-rendered nested link list — every item is a real `<a>`, no collapse/disclosure state; `items` (`{ label, href, items? }[]`) + `currentPath`.                                                                                                            |
| `CommandPalette`                | organisms | `Dialog`/`DialogContent`/`DialogTitle`-backed command list with a filterable `SearchField` and `Kbd` shortcut hints; `open`/`onOpenChange`/`commands`.                                                                                                         |
| `useDsForm` (hook)              | —         | Currently a direct alias of `@tanstack/react-form`'s `useForm` — a thin re-export, not yet a bespoke wrapper. Noted so the gap between this and the original "wraps form/field state" description is explicit.                                                 |

**A note on `NavigationMenu` and layout patterns:** `docs/agents/layout-patterns.md`
does not reference a "nav-item-list primitive," despite an earlier planning
document's claim that it does. That file only covers app-specific layout
compositions (Header, Footer, Hero, Sidebar, TopBar, StatCard) and doesn't
discuss nav-item lists at all, so no genuine cross-reference exists to add.
Left as-is rather than inventing one.

## shadcn → Miltinson mapping reference

| shadcn component                                         | Miltinson equivalent / notes                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Badge                                                    | `Badge` — maps to preview tags (default, signal, anchor, solid, outline)                                                                               |
| Button                                                   | `Button` — primary, accent, secondary, ghost; sm/md/lg sizes                                                                                           |
| Card                                                     | `Card` + subcomponents — matches preview portfolio cards                                                                                               |
| Input, Textarea, Select, Label                           | Form primitives — match `components-fields.html` preview                                                                                               |
| Alert                                                    | `Alert` — status tokens for success/warning/danger/info                                                                                                |
| Separator                                                | `Separator` — `--border` hairline                                                                                                                      |
| Tabs                                                     | `Tabs` — ink underline active state                                                                                                                    |
| Dialog                                                   | `Dialog` — native `<dialog>` with token surfaces                                                                                                       |
| DropdownMenu, Popover, Tooltip, Sheet, Toast             | Overlay primitives — portal positioning, keyboard nav, aria-live toasts                                                                                |
| Avatar, Breadcrumb, Checkbox, Switch, Skeleton, Progress | Styled per tokens; check UI kits for context                                                                                                           |
| Eyebrow, RuleLink                                        | Marketing typography primitives from ui_kits                                                                                                           |
| RadioGroup                                               | `RadioGroup` / `RadioGroupItem` — context-based group, native radios                                                                                   |
| Slider                                                   | `Slider` — labelled native `<input type="range">`                                                                                                      |
| Pagination                                               | `Pagination` — page-button list, `aria-current="page"`                                                                                                 |
| Accordion                                                | `Accordion` — compound, configurable heading level                                                                                                     |
| Calendar / Date Picker                                   | `DatePicker` — popover date grid, ARIA `grid`/`row`/`gridcell`                                                                                         |
| Combobox                                                 | `Combobox` — filterable listbox popup, virtualized option list                                                                                         |
| Data Table (TanStack Table recipe)                       | `Table` — `@tanstack/react-table` row models, opt-in `virtualize`                                                                                      |
| NavigationMenu                                           | `NavigationMenu` — simplified: always-rendered nested list, no submenu disclosure/triggers                                                             |
| Command (cmdk)                                           | `CommandPalette` — built on this repo's `Dialog`, not the `cmdk` library                                                                               |
| Kbd (registry component)                                 | `Kbd` — styled `<kbd>`, used for shortcut hints                                                                                                        |
| Badge (removable variant)                                | `Chip` — shadcn ships no removable badge; sized to the MUI/shadcn dense scale                                                                          |
| Toggle Group                                             | `SegmentedControl` — closest shadcn analog; a primary control, keeps the 44px target                                                                   |
| Form / FormField (react-hook-form)                       | `FormField` — same render-prop-to-a11y-bundle idea, not bound to react-hook-form                                                                       |
| —                                                        | `SearchField`, `Stepper`, `EmptyState`, `Rating`, `VirtualList`, `useDsForm` — no direct shadcn primitive; local patterns (see "New components" above) |
