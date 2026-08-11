# @elirobinson/react

## 1.3.0

### Minor Changes

- 37334d4: Upgrade `@tanstack/react-table` from v8 to v9 (`^9.1.2`) and rewrite `Table` / `VirtualTable`
  against the real v9 API — `useTable` plus a `tableFeatures()` feature set and
  `create*RowModel()` factories, replacing v8's `useReactTable` and `get*RowModel()` options.

  **Runtime dependency major.** `@tanstack/react-table` is a regular dependency of this package,
  so bumping it upgrades transitively and needs no action from you — unless you import
  `@tanstack/react-table` yourself. If your own code does
  `import type { ColumnDef } from '@tanstack/react-table'` and passes those columns to our
  `Table`, that type no longer matches: v9's `ColumnDef` takes the table's feature set as its
  first generic. Import `ColumnDef` from `@elirobinson/react/components/organisms/Table`
  instead, which is unchanged and still single-generic (`ColumnDef<Row>`).

  No change to any component's props, DOM, or behaviour. `Table` and `VirtualTable` keep the same
  public API, including `data`, `columns`, `pageSize`, `emptyMessage`, `filterable`, and
  `filterPlaceholder`, and the exported `ColumnDef<T>` type keeps the shape it had under v8.

  This deliberately does **not** use `@tanstack/react-table/legacy`, the library's `@deprecated`
  v8 compatibility shim, so no deprecated import reaches consumers. Features are registered
  individually rather than via `stockFeatures`, keeping grouping, pinning, resizing, selection,
  faceting, and expanding out of your bundle.

## 1.2.0

### Minor Changes

- 8c7d56b: Generate `manifest.json` at build time and export it as `@elirobinson/react/manifest`.

  Per component: name, tier, import subpath, the exact import specifier, exported value
  names, exported type names, props type name, and variant unions with their allowed values —
  whether the union is written inline (`size?: 'sm' | 'md'`) or behind an exported alias
  (`variant?: ButtonVariant`). Hooks get the same treatment.

  This is the name → subpath map the `no-barrel-imports` contract has always implied was
  knowable but never published, and it lets tooling stop regex-parsing `dist/**/*.d.ts`. The
  manifest is built from the TypeScript AST, so it is not sensitive to how declarations
  happen to be emitted. Discovery walks `src/components` rather than assuming a layout; a
  flat directory yields `tier: null` and still works.

  Additive: every existing export subpath is unchanged.

### Patch Changes

- a82dcc9: Add `ds-resync`, a command for bringing a consuming repo's `@elirobinson/*` packages up to
  date. A bare run reports current versus latest per package along with the changelog entries
  in between; `--write` rewrites the ranges and installs.

  `@elirobinson/react` and `@elirobinson/tokens` now ship `CHANGELOG.md` in their published
  tarballs, which is what makes the migration notes readable from a consuming repo.

- Updated dependencies [a82dcc9]
- Updated dependencies [8c7d56b]
  - @elirobinson/tokens@0.3.0

## 1.1.0

### Minor Changes

- 1f88949: `NavigationMenu`: make `href` optional on `NavigationMenuItem`. An item without one renders
  as an inert `<span>` group label instead of an `<a>` — not focusable, not a navigation
  target, and never marked as the current page — and names its nested list via
  `aria-labelledby`.

  Previously a section header had to borrow its first child's href to satisfy the required
  `href`, which made the header render as active whenever that child was open and emitted a
  second `aria-current="page"` alongside the real one.

## 1.0.2

### Patch Changes

- 0dbb837: Fix `defaultOpen` being silently ignored on all four overlay components.

  `Dialog`, `Sheet`, `Popover`, and `DropdownMenu` each declared
  `defaultOpen?: boolean` in their props type, but none of them destructured it —
  every one hardcoded `useState(false)`. The prop typechecked, so consumers had
  no signal it did nothing; `<Dialog defaultOpen>` simply rendered closed.

  All four now seed their uncontrolled state from `defaultOpen`. A controlled
  `open` prop still wins, so `defaultOpen` only applies when `open` is omitted.

  Note for `Popover` and `DropdownMenu`: now that `defaultOpen` works, it reaches
  the same portal that `open` does, so a server-rendered `defaultOpen` overlay
  relies on the mount gate added alongside it — its content appears one commit
  after hydration rather than in the server markup.

## 1.0.1

### Patch Changes

- 4b507a2: Fix portal components crashing during server rendering.

  `Toaster`, `PopoverContent`, and `DropdownMenuContent` called
  `createPortal(…, document.body)` during render, so a Next.js or Remix consumer
  hit `ReferenceError: document is not defined` at SSR/build time.

  `Toaster` was broken outright — it portals on every render, so merely wrapping
  an app in it took the build down, and because `useToast` throws outside the
  provider there was no client-only workaround. `Popover` and `DropdownMenu` were
  conditional: both return early while closed, so they only crashed when
  server-rendered already open via the `open` prop.

  All three now gate the portal on a new shared `useHasMounted` hook. The server
  pass and the first client render agree (no portal), so hydration stays clean,
  and the content attaches on the commit that follows. `Tooltip` already guarded
  on its trigger ref and was never affected; it gains regression coverage.

## 1.0.0

### Major Changes

- af5497d: Move every published component under an atomic-tier subpath (`atoms/`, `molecules/`, `organisms/`) and add 19 new components.

  **Breaking: import paths now include the atomic tier.**

  ```diff
  - import { Button } from '@elirobinson/react/components/Button';
  + import { Button } from '@elirobinson/react/components/atoms/Button';
  ```

  Every existing component moved to its tier — e.g. `Card`/`Alert` → `components/molecules/`, `Badge`/`Button`/`Input`/`Avatar` → `components/atoms/`, `Dialog`/`Select`/`Tabs` → `components/organisms/`. See `docs/agents/components.md` for the full tier boundary rule and the shadcn mapping table.

  New components, by tier:
  - **atoms**: `RadioGroup`/`RadioGroupItem`, `Spinner`, `Slider`, `Kbd`
  - **molecules**: `Chip`, `FormField`, `SearchField`, `Pagination`, `Stepper`, `SegmentedControl`, `EmptyState`, `Rating`
  - **organisms**: `VirtualList`, `Accordion`, `DatePicker`, `Combobox`, `Table`, `VirtualTable`, `NavigationMenu`, `CommandPalette`
  - **hooks**: `useActiveDescendant`, `useRovingFocus`

  New dependencies: `@tanstack/react-table`, `@tanstack/react-virtual`.

  **Per-component stylesheets.** `@elirobinson/react/styles.css` is unchanged as the
  single entry point and still carries every component. Individual stylesheets are
  now also importable for consumers who want to pull in only what they use:

  ```ts
  import '@elirobinson/react/styles/atoms/Button.css';
  ```

## 0.4.0

### Minor Changes

- 52b1b6d: Remove the root barrel export. Import components from `@elirobinson/react/components/<Name>` so App Router apps only load the modules they use.

### Patch Changes

- Updated dependencies [52b1b6d]
  - @elirobinson/tokens@0.2.0

## 0.3.0

### Minor Changes

- 5fcffbf: Add overlay primitives (DropdownMenu, Popover, Tooltip, Sheet, Toast), marketing typography (Eyebrow, RuleLink), expanded tokens.json, Storybook coverage, and unit tests for interactive components.

### Patch Changes

- Updated dependencies [5fcffbf]
  - @elirobinson/tokens@0.1.2

## 0.2.0

### Minor Changes

- c019e9e: Add shadcn-inspired components styled with Miltinson tokens: Badge, Label, Textarea, Select, Alert, Separator, Tabs, Dialog, Avatar, Breadcrumb, Checkbox, Switch, Skeleton, and Progress. Enhance Button with accent/ghost variants and sizes, Card with compound subcomponents, and Input with hint/error states.

## 0.1.1

### Patch Changes

- 60e0c53: Publish design system packages to the GitHub Packages npm registry.
- Updated dependencies [60e0c53]
  - @elirobinson/tokens@0.1.1
