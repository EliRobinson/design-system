# Component library expansion — atomic reorg + gap coverage

**Date:** 2026-08-06
**Status:** Approved, pending implementation plan

## Context

The user removed shadcn-derived primitives (Badge, Button, Card, Input, Label, Separator, Skeleton) from a Next.js template in favor of `@elirobinson/react`. Coverage check confirmed all seven already exist in `packages/react/src/components/`.

The broader goal: make Miltinson versatile enough to build "many different kinds of websites" across the user's projects — general-purpose (marketing, SaaS dashboards, e-commerce, etc.). This spec covers (1) reorganizing the component library into atomic-design tiers and (2) closing gaps against Material Design 3 and Apple HIG's common component surface.

## A. Atomic tier structure

Reorganize `packages/react/src/components/` into three tiers:

```
components/
  atoms/       — single-purpose, not further divisible
  molecules/   — a few atoms combined into one functional unit
  organisms/   — compound components with internal state and/or overlay orchestration (portals, focus trapping, keyboard nav)
```

Import paths change accordingly (e.g. `@elirobinson/react/components/atoms/Button`), consistent with the existing no-barrel-files, subpath-import convention (`.cursor/rules/no-barrel-files.mdc`).

**Boundary rule:** if a component renders into a portal, traps focus, or manages open/closed state across multiple sub-elements → organism. If it's assembled from 2+ atoms but has no such orchestration → molecule. Everything else → atom.

`docs/agents/components.md` gets updated with this tier boundary rule so future additions land in the right place.

## B. Full target component set

### Existing 24 — recategorized, no behavior change

| Atoms (12)                                                                                              | Molecules (4)                     | Organisms (8)                                                      |
| ------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| Avatar, Badge, Button, Checkbox, Eyebrow, Input, Label, Progress, Separator, Skeleton, Switch, Textarea | Alert, Breadcrumb, Card, RuleLink | Dialog, DropdownMenu, Popover, Select, Sheet, Tabs, Toast, Tooltip |

### New — 19 components closing gaps vs. Material 3 / Apple HIG

| Tier     | Component        | Reference                                            | Rationale                                                                                                                                |
| -------- | ---------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Atom     | RadioGroup       | M3 Radio button / HIG Radio buttons                  | Checkbox & Switch exist, single-select doesn't                                                                                           |
| Atom     | Spinner          | M3 Circular progress / HIG Activity indicator        | Progress is determinate-only; no indeterminate loading atom                                                                              |
| Atom     | Slider           | M3 Slider / HIG Slider                               | Settings, filters, media UIs                                                                                                             |
| Atom     | Kbd              | Utility                                              | Shortcut-hint atom, used by CommandPalette and docs                                                                                      |
| Molecule | Chip             | M3 Chips / HIG Tags                                  | Filters, multi-select tokens, removable tags                                                                                             |
| Molecule | FormField        | M3 Text field supporting text / HIG field validation | Label+input+hint+error wrapper — form-completeness gap                                                                                   |
| Molecule | SearchField      | M3 Search / HIG Search field                         | Input+icon+clear as its own pattern                                                                                                      |
| Molecule | Pagination       | M3 Pagination pattern                                | List/table-heavy sites                                                                                                                   |
| Molecule | Stepper          | M3 / HIG page-indicator pattern                      | Multi-step flows (onboarding, checkout, wizards)                                                                                         |
| Molecule | SegmentedControl | HIG Segmented control                                | View-switching, no current equivalent                                                                                                    |
| Molecule | EmptyState       | M3/HIG empty-state guidance                          | "Nothing here yet" state for lists/dashboards                                                                                            |
| Molecule | Rating           | Common e-commerce/review pattern                     | Star rating input/display                                                                                                                |
| Organism | Accordion        | M3/HIG disclosure pattern                            | FAQ/settings-group pattern                                                                                                               |
| Organism | Combobox         | M3 Autocomplete / HIG search-as-you-type             | Select can't filter/search options                                                                                                       |
| Organism | DatePicker       | M3 Date picker / HIG Date picker                     | Currently absent entirely                                                                                                                |
| Organism | Table            | TanStack Table wrapper                               | Dashboard data-display gap                                                                                                               |
| Organism | CommandPalette   | Cmd+K pattern (modern SaaS convention)               | App-shell navigation                                                                                                                     |
| Organism | NavigationMenu   | M3 Navigation rail/drawer / HIG sidebar              | In-package nav-item list primitive (distinct from app-specific Header/Sidebar layout compositions, see `docs/agents/layout-patterns.md`) |
| Organism | VirtualList      | TanStack Virtual wrapper                             | Backs Table/Combobox for large datasets; usable standalone                                                                               |

Total library size after this pass: 43 components.

## C. TanStack adoption

Same philosophy as the existing shadcn convention: use TanStack for headless logic/state, style everything with tokens. TanStack ships no default styling, so this is a clean fit — same "borrow the API shape and behavior, not the visuals" approach already documented for shadcn.

- **`@tanstack/react-table`** → `organisms/Table.tsx`: sorting, filtering, pagination hookup, typed column defs via generics. Footer pagination controls compose the new `Pagination` molecule.
- **`@tanstack/react-virtual`** → `organisms/VirtualList.tsx`: generic virtualized list wrapper. `Table` uses it internally for large row counts (opt-in prop); `Combobox` uses it for long option lists. Also exported standalone.
- **`@tanstack/react-form`** → not a UI component. Lands as a hook module (`packages/react/src/hooks/useDsForm.ts`) wrapping form/field state so `FormField` molecules can bind to it. Consumers may still use plain React state with `FormField` without adopting the form library.

All three become direct dependencies of `@elirobinson/react` (not peer deps — they're internal implementation detail of the components, not something consumers are expected to configure themselves).

## D. Phasing plan

Single spec, staged implementation. Each phase should pass build/typecheck/lint/storybook before starting the next.

1. **Phase 0 — Reorg.** Move existing 24 components into `atoms/molecules/organisms`, update all internal imports, Storybook story imports, and `docs/agents/components.md`. No behavior change.
2. **Phase 1 — Atoms.** RadioGroup, Spinner, Slider, Kbd. No new dependencies; unblocks later molecules.
3. **Phase 2 — Molecules.** Chip, FormField, SearchField, Pagination, Stepper, SegmentedControl, EmptyState, Rating.
4. **Phase 3 — TanStack infra.** VirtualList, `useDsForm` hook — built before the organisms that depend on them.
5. **Phase 4 — Organisms.** Accordion, Combobox, DatePicker, Table, CommandPalette, NavigationMenu.

## Conventions carried forward (unchanged)

Per `docs/agents/components.md`, every new/moved component:

- Styled against Miltinson tokens (`ds-*` classes, `packages/react/src/styles.css`), no Tailwind.
- `forwardRef` for interactive elements, 44px minimum touch targets, visible `:focus-visible` rings via `--focus-ring`.
- Native HTML elements + React state; skip Radix unless explicitly requested (TanStack is the one approved exception, being headless-only with no styling opinions).
- Exported from `@elirobinson/react` via subpath import.
- Storybook story in `apps/storybook/src/stories/`.
- Match brand preview swatches in `design-system-docs/preview/` where a visual precedent exists.

## Out of scope

- Header/Footer/Hero/Sidebar/TopBar/StatCard layout compositions remain app-specific per `docs/agents/layout-patterns.md` — NavigationMenu (organism) is a nav-item-list primitive, not a replacement for those.
- No visual design token changes — new components use the existing token set.
