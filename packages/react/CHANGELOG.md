# @elirobinson/react

## 2.0.1

### Patch Changes

- Updated dependencies [b11ae1b]
  - @elirobinson/tokens@0.5.0

## 2.0.0

### Major Changes

- cc6dd9d: Narrow the `./styles/*` export to `./styles/*.css`.

  The subpath was mapped straight onto the components directory:

  ```json
  "./styles/*": "./src/components/*"
  ```

  Anything under `src/components` resolved through it, so
  `@elirobinson/react/styles/atoms/Button.tsx` was a valid import — raw,
  untranspiled component source reachable through a path named "styles". The map
  is now `"./styles/*.css": "./src/components/*.css"`, which serves stylesheets
  and nothing else.

  **Migration:** every documented and generated specifier already ends in `.css`
  (`@elirobinson/react/styles/atoms/Button.css`, and nested sheets like
  `@elirobinson/react/styles/organisms/table/core.css`) and is unaffected —
  verified by resolving all 41 unique `stylesheetPaths` in the component manifest
  (49 occurrences) under both the CJS and ESM resolvers. If you were importing
  anything else through `styles/*`, import the component from
  `@elirobinson/react/components/<tier>/<Name>` instead.

  **Why `major` and not `minor`.** Serving TSX from `styles/*` was plainly
  unintended, and the argument for a smaller bump is real: no consumer can
  sensibly have depended on it, and 2.0.0 makes a version wall out of closing a
  hole nobody was meant to walk through. It is still a major. A subpath that
  resolved yesterday and throws `ERR_PACKAGE_PATH_NOT_EXPORTED` today is a
  breaking change to the package's public surface whatever we meant the surface to
  be — the exports map _is_ the contract, and intent is not something a consumer's
  build can read. The upgrade costs nothing for correct usage, so the honest
  version number is cheap here; picking `minor` would buy a tidier changelog with
  someone else's broken build.

- 2c3c5e7: One llms corpus generator, owned by `@elirobinson/ai-patterns`.

  The generator that renders `llms.txt` and `llms-full.txt` existed twice, written
  independently and producing the same format: once in `apps/docs` for the live
  `/llms.txt` routes, once in this package for the snapshot that ships in the
  tarball. `INTRO` and the import rules were duplicated character for character;
  the prop tables, component sections, and index were reimplemented. Both files
  opened with a comment asserting the other was its twin, which is not a mechanism
  — they had already drifted.

  There is now one implementation, published as `@elirobinson/ai-patterns/corpus`
  (`llmsIndex`, `llmsFull`, `versionStamp`, `RESYNC_COMMAND`), with a hand-written
  `llms.d.ts` and a drift test against it, matching how `./testing/playwright` is
  published. It is parameterized by the four things that genuinely differ between
  the two callers, each optional and absent by default:
  - `versions` — stamps the output as a snapshot. The docs site passes none.
  - `prose` — the Foundations and Patterns pages, as plain markdown.
  - `componentAppendix` — extra blocks per component section; the docs site
    appends the page prose and a `/r/<slug>.json` link.
  - `alsoAvailable` — the "what else is here" bullets, which are URLs on a website
    and filenames plus a CLI in a tarball.

  The packed snapshot is byte-identical to what it produced before, and so is the
  docs `/llms.txt`. Two docs outputs change, both deliberately:
  - `/llms-full.txt` gains exactly one trailing newline, so neither a file nor a
    `text/plain` body ends mid-line. Nothing else in it moves.
  - `/r/<slug>.json` spreads the manifest record, so its `importPath` key is now
    `importSpecifier` — the same rename described below, surfacing on the one
    machine-readable route that isn't a corpus.

  Two fixes that only became possible once there was one reader:
  - Component order is driven off `manifest.tiers` rather than a hardcoded
    `['atoms', 'molecules', 'organisms']` in each copy. A tier added to
    `@elirobinson/react` used to drop every component in it out of the corpus
    silently; it now appears, and a component the manifest gives no tier is
    emitted after the tiers rather than discarded.
  - `@elirobinson/react`'s manifest drops `importPath`, which was a byte-identical
    alias of `importSpecifier` published only so the docs site and the `ds` CLI
    could each keep their own name for it. `importSpecifier` is the one name.

  Removing a published manifest field is breaking, so `@elirobinson/react` is
  marked `major`. It is already taking a `major` in this batch, and the field
  being removed was introduced in this same unreleased batch, so no released
  reader ever saw it — but the manifest is a published contract and the bump
  should say what happened to it rather than what it cost.

### Minor Changes

- 363f9da: Forward refs through `DialogTrigger`, `DialogClose`, `SheetTrigger` and
  `SheetClose`, and widen their props to `ButtonHTMLAttributes`.

  All four render a `<button>` but were plain function components, which the
  `forward-ref` contract has always disallowed:

  > Every component that renders a focusable or interactive native element uses
  > `forwardRef`, forwarding to the outermost interactive element the component
  > owns.

  They all delegate to the shared `ModalTrigger` / `ModalClose` parts, so the fix
  is one `forwardRef` in the shared parts plus forwarding through the four public
  wrappers. The refs resolve to the `<button>` node itself. These parts own their
  button outright and hold no second reference to it, so they forward the ref
  directly rather than merging it the way `ModalSurface` has to.

  **On React 19 the runtime half of this already worked by accident.** `ref` is an
  ordinary prop for function components there, so it rode the `{...props}` spread
  down to the `<button>`. The defect that bit consumers was at the type level: the
  props were `HTMLAttributes<HTMLButtonElement>`, which carries no `ref` and no
  button attributes, so `<DialogTrigger ref={...}>` and `<DialogClose disabled>`
  were both type errors on components that would have honoured them at runtime.

  **Props widening.** The four props types are now
  `ButtonHTMLAttributes<HTMLButtonElement>`, matching `DropdownMenuTriggerProps`
  and `DropdownMenuItemProps`. This adds `disabled`, `type`, `form`, `name` and
  `value`, and is additive — every currently valid usage still compiles.

  `type="button"` stays a default rather than a pin: it precedes the prop spread,
  so a consumer-supplied `type` wins. That matches `DropdownMenuItem`,
  `ToastAction` and `AnchoredOverlayTrigger`, and it keeps a close button that
  also submits an enclosing form expressible. Accepting `type` in the props type
  and then silently discarding it would be the worse option — a prop the types
  advertise and the component ignores.

- b393053: One component manifest, owned by `@elirobinson/react`.

  `./manifest` now carries everything the two extractors used to produce
  separately. Alongside the existing `name` / `tier` / `subpath` /
  `importSpecifier` / `exports` / `types` / `propsType` / `variants`, every
  component record gains `slug`, `description`, `props` (full prop tables with
  types, defaults, required flags, and per-prop JSDoc), `subComponents`, `hooks`,
  `inherits`, `stylesheetPaths`, `constraints`, and `extractionGaps`; hook records
  gain `description`. `manifestVersion` is `2`. `./manifest` also gains a `types`
  condition, so it is a typed import rather than an `any`.

  `minor` rather than `major`: every v1 field keeps its name and its meaning, so a
  v1 reader keeps working. Three things do change, none of them a v1 field:
  - `inherits` now names bases the previous regex-based extractor gave up on
    (`Table`, `VirtualList`, `VirtualTable`, `Accordion` said `null` and now name
    the type they extend).
  - `organisms/table/core`, which exports helpers `Table` and `VirtualTable`
    share rather than a component of its own name, is no longer listed as a
    component. It was never importable as one, and the types it exports
    (`ColumnDef` and friends) are re-exported from `Table`.
  - The docs-side record's `exportedTypes` is not carried over under that name —
    `types`, which the manifest already published, is the same list derived from
    the AST rather than a regex, and a superset of it.

  Descriptions for components whose source carries no JSDoc still come from a
  curated fallback list, which moved with the extractor to
  `packages/react/scripts/component-descriptions.json`. It moved rather than being
  replaced because removing it means writing JSDoc on 44 components in
  `packages/react/src`, which this change deliberately does not touch; its header
  now says out loud that every entry in it is debt.

  `@elirobinson/ai-patterns` is a `patch`: its published output is unchanged, but
  `build-artifacts.mjs` now reads `@elirobinson/react/manifest` instead of a
  generated file inside `apps/docs`, so producing the tarball no longer depends on
  a documentation app.

### Patch Changes

- 073be2b: Extract the overlay primitives the organisms were duplicating, and fix a duplicate-id accessibility bug that fell out of the copy.
  - New `useDisclosure` hook (`@elirobinson/react/hooks/useDisclosure`) owns the controlled/uncontrolled open-state pattern that `Dialog`, `Sheet`, `Popover`, and `DropdownMenu` each carried their own copy of.
  - `Dialog` and `Sheet` now build on one shared modal surface, and `Popover` and `DropdownMenu` on one shared anchored overlay.
  - **Accessibility fix:** `Dialog` and `Sheet` minted their title and description ids from the constants `ds-dialog-title` / `ds-sheet-title`. Two dialogs on one page emitted duplicate DOM ids, and every `aria-labelledby` resolved to whichever rendered first, so the second dialog announced the first one's title. Both now use `useId()`.
  - `Tooltip` uses the shared `useAnchoredPosition` hook instead of measuring its trigger during render, so it repositions on scroll and resize. `useAnchoredPosition` gained optional `align` and `zIndex` options and now keeps every anchored panel in place through scroll and resize.
  - `useClickOutside` and `useEscapeKey` no longer re-attach their document listeners on every render.

  No public API changes: every exported name, prop, and CSS class name is unchanged.

- Updated dependencies [c6cfaa0]
  - @elirobinson/tokens@0.4.0

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
