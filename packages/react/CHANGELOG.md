# @elirobinson/react

## 2.2.0

### Minor Changes

- 92587b1: Add six components for decision and assistant surfaces, and a new `ai` tier.

  They were designed and proven in a product built on this system, where every one of them
  had been hand-built because the library had no equivalent. Everything below is additive —
  no existing component, class, or token changed, so upgrading needs no migration. What
  follows is how to adopt them.

  ## New imports

  There is no barrel; each component is its own subpath.

  ```tsx
  import { ChatThread } from '@elirobinson/react/components/ai/ChatThread';
  import { ChatMessage } from '@elirobinson/react/components/ai/ChatMessage';
  import { StreamingCaret } from '@elirobinson/react/components/ai/StreamingCaret';
  import { VerdictBadge } from '@elirobinson/react/components/molecules/VerdictBadge';
  import { StubCard } from '@elirobinson/react/components/molecules/StubCard';
  import { DecisionCard } from '@elirobinson/react/components/organisms/DecisionCard';
  ```

  `ai/` is a **new tier directory**. If your app imports the aggregate
  `@elirobinson/react/styles.css` you already have their styles. If you import per-component
  sheets instead, add these:

  ```css
  @import '@elirobinson/react/styles/ai/ChatThread.css';
  @import '@elirobinson/react/styles/ai/ChatMessage.css';
  @import '@elirobinson/react/styles/ai/StreamingCaret.css';
  @import '@elirobinson/react/styles/molecules/VerdictBadge.css';
  @import '@elirobinson/react/styles/molecules/StubCard.css';
  @import '@elirobinson/react/styles/organisms/DecisionCard.css';
  ```

  If you keep your own list of tiers anywhere — a codegen script, a docs sidebar, a lint
  rule — it now needs `ai` alongside `atoms`, `molecules`, `organisms`. Better: read
  `@elirobinson/react/manifest`, whose `tiers` array is derived from the directory layout
  and already contains it.

  ## Required props, so a first render does not fail

  These are the props with no default. Everything else is optional.
  - `ChatThread` — **`label`** (string). The accessible name of the log region. There is no
    copy inside the component, so this is not optional and there is no fallback.
  - `ChatMessage` — **`avatar`** (node). Required on purpose: there is no role-derived
    avatar. Pass a glyph, an initial, or an `<img>`. `variant` is `'sent' | 'received'` and
    defaults to `'received'`.
  - `VerdictBadge` — **`verdict`** (`'go' | 'no' | 'hold'`) and **`label`** (string, the
    word). The glyph is supplied per verdict and can be overridden with `glyph`.
  - `StubCard` — **`title`**, **`items`** (`{ label, value }[]`), **`stubLabel`**,
    **`stubValue`**.
  - `DecisionCard` — **`verdict`**, **`verdictLabel`**, **`headline`**.

  If you are migrating a hand-built chat surface, note that `ChatMessage` takes `actions` as
  a **node**, not an `[{ label, onClick }]` array, and has no `citations` prop. Render your
  own controls into `actions`.

  ## `DecisionCard` renders no footer when there is no action

  This is a product guarantee, not a style choice, and adopting `DecisionCard` means
  adopting it: when the `action` prop is absent, the component renders **no
  `.ds-decision__foot` element at all** — not a disabled button, not a hidden one, nothing.
  The card is structurally incapable of showing a payment control under a negative verdict.
  Pass `closing` to give that verdict its last word; it renders in the body.

  Two consequences for a consumer:
  - Do not pass `action={<Button disabled />}` to represent "no action available". Omit
    `action` entirely. Passing a disabled node re-creates exactly the failure the guarantee
    exists to prevent.
  - Any CSS or test of yours that assumes `.ds-decision__foot` is always present will not
    match on a card without an action. Query it conditionally.

  `StreamingCaret` has the sibling rule: `active={false}` returns `null` rather than
  rendering a hidden element, so it cannot be left mounted on a finished message. Drive it
  from the same state that decides whether the stream is still running.

  ## Opting into the product token layer (optional)

  All six read an optional `--product-*` layer, and every read falls back to a system token,
  so doing nothing keeps the Miltinson defaults and full contrast coverage. To give your
  product its own signal without forking the token set:
  1. Copy `docs/agents/tokens.product-layer.css` from the design-system repo into your app
     and import it **after** `@elirobinson/react/styles.css`.
  2. Put `data-product="<your-app>"` on the subtree your product owns — your app shell, not
     `<html>`.
  3. Re-point only the variables you actually own:
     `--product-signal` (a non-text state graphic, needs 3:1), `--product-signal-fg` (brand
     colour a user reads), and the three verdict pairs `--product-verdict-{go,no,hold}` with
     their `-fg` counterparts.

  Two rules that will bite otherwise. **Override a fill and its foreground together** — a
  verdict pair is two variables for one decision, and re-pointing only the fill is how a
  light tint ends up carrying light text in dark mode. And **write dark overrides as
  descendant selectors** (`[data-theme='dark'] [data-product]`, plus `.dark [data-product]`
  for class-strategy switchers), because the theme attribute normally sits on `<html>`,
  above your product scope — `[data-product][data-theme='dark']` matches nothing.

  Full reference: `docs/agents/product-token-layer.md`.

  ## Also in this release

  `@elirobinson/ai-patterns`: the brand manifest gains a `component-card` category for
  component specimen cards, and the design-project build no longer treats `ChatMessage` and
  `ChatThread` as project-owned components now that the package ships them.

## 2.1.5

### Patch Changes

- Updated dependencies [6b67f05]
  - @elirobinson/tokens@0.8.0

## 2.1.4

### Patch Changes

- 64f3f58: Measure the surface that actually takes the click. Closes #65.

  Running the published browser contracts against this repo's own components for
  the first time produced 62 touch-target and 2 focus-visible findings across 84
  stories in both themes. Four of the 62 were real. The rest were the checks
  measuring the wrong element, and every one of them reaches consumers.

  **`DENSE_AFFORDANCE_SELECTOR` named a glyph, not a control.** It listed
  `.ds-rating__star`, which Rating puts on the `<span>` inside the button — the
  control is `button.ds-rating__button`. The documented exemption had never
  matched anything, so the affordance the contract explicitly carves out was
  failing the contract. `.ds-calendar__day` went the same way for a different
  reason: there is no Calendar component, and an exemption that outlives its
  reason is how a sweep goes quiet. Both are now asserted against markup rather
  than against the string, because a class list is only as good as the elements it
  lands on.

  **A form control's hit area is not always the control.** A `<label>` forwards
  its clicks, so in the standard "18x18 native input, real text label" pairing the
  label is what a finger goes for, and measuring the box measures something nobody
  aims at. `checkTouchTargets` now passes a control when either its own hit area
  or a single label that activates it clears 44x44. It has to be one surface: an
  input and a label 12px apart do not add up to one 44px target, and treating them
  as if they did would pass every checkbox ever written. An unlabelled 18x18
  checkbox still fails, and so does one whose label is a 20px sliver of text.

  **Controls nothing routes to are no longer reported as 1x1.** The reach walk
  starts at ±1px and never tested the centre, so it could not tell "tiny" from
  "occluded". With a modal `<dialog>` open Chromium attributes hits over the
  `::backdrop` to the dialog, so every control behind it measured 1x1 — an
  untouched 186x44 button was told to add padding, which would have done nothing.
  `checkFocusVisible` had the mirror of the same bug: focus is refused on an inert
  control, the snapshots match trivially, and a control with a perfectly good ring
  was reported as missing one. Both now skip what they cannot validly measure.
  Any consumer page with an open `Dialog`, `Sheet` or `CommandPalette` was hitting
  this.

  `TouchTargetViolation` gains optional `labelWidth` / `labelHeight`, reported
  when a label was considered and was also too small, so the message says what was
  measured instead of leaving the reader to wonder why the label next door did not
  rescue an 18x18 box.

  **In `@elirobinson/react`, the components that were measuring wrong now carry
  the hit area they always appeared to have**, with no change to a single painted
  pixel — verified by screenshotting all 84 stories in both themes before and
  after:
  - `Checkbox`, `Switch` and `RadioGroup` make the row itself the `<label>`
    instead of wrapping one in a `<div>`. The 44px row was already there; a div
    just forwarded nothing. Radio needed it twice over — option text as short as
    "Ash" measured 28x23, so even a full-height text label would not have reached
    44px wide, while the row with the input and gap does.
  - `Breadcrumb` links and `RuleLink` get bounded overlays. Both are nav items, so
    the 44px rule applies rather than the dense scale, but padding would have
    spaced out the trail and pushed RuleLink's underline — which is the
    component's whole identity — down the page. The overlays give the same 44x44 a
    finger needs and move nothing, bounded so they cannot reach a neighbour's
    centre.
  - The table sort toggle declares `data-touch-target="dense"`. It is grid chrome
    inside a header cell, the same family as the chip remove and the calendar day,
    and its 24px hit area is the WCAG 2.2 AA floor; taking it to 44 would mean a
    44px-tall header row on every table in the system. Declared on the element
    rather than added to `DENSE_AFFORDANCE_SELECTOR`, which is what that list's
    own documentation asks for.

  That leaves one finding, deliberately unfixed: `.ds-button--sm` has an 89x36 hit
  area. `contracts.json` names buttons as primary controls needing 44x44, and 36px
  is exactly shadcn's `size="sm"`, so the variant cannot satisfy the rule and stay
  a small button. Exempting it would say buttons are exempt from the button rule.
  It is left failing for a deliberate decision rather than settled quietly here.

- Updated dependencies [64f3f58]
  - @elirobinson/tokens@0.7.3

## 2.1.3

### Patch Changes

- Updated dependencies [96e25db]
  - @elirobinson/tokens@0.7.2

## 2.1.2

### Patch Changes

- efe61c0: Emit fully-specified relative ESM specifiers in dist (`./utils.js`, not `./utils`). tsc now compiles with `module: NodeNext`, so the built files load under Node's own resolver — a Vite SSR dev server no longer throws `ERR_MODULE_NOT_FOUND` on every component, and the `ssr.noExternal: ['@elirobinson/react']` workaround can be dropped. Every build now ends by importing all of dist with plain `node` (`scripts/smoke-dist.mjs`), so an extensionless specifier can't ship again.
- Updated dependencies [0917a4d]
  - @elirobinson/tokens@0.7.1

## 2.1.1

### Patch Changes

- 8cc5a0b: Give the brand tints dark values, and add `--anchor-ink`. Closes #60.

  `--accent-tint` and `--anchor-tint` were the last colours in the system with no
  dark override: `--signal-50` and `--anchor-50` stayed 96–97% light on a black
  page. That reached consumers directly — both are aliased in the Tailwind bridge,
  and `tailwind.css` recommends `bg-accent-tint` as the substitute for shadcn's
  "accent as hover tint", so taking that advice produced a near-white block in
  dark mode. They now mirror the way `--status-*-tint` already worked, a wash at
  the same hue: `oklch(22% 0.05 70)` amber, `oklch(20% 0.04 160)` forest.

  **New token: `--anchor-ink`** (`--anchor-600`, 11.41:1 light; `oklch(78% 0.13 160)`,
  11.07:1 dark) — the forest counterpart to `--accent-ink`. `--anchor` itself is
  8.13:1 on white but 2.58:1 on black, so forest text needed a token that inverts.
  It is aliased as `text-anchor-ink`, and is measured against `--bg` in both
  themes by the same rule that covers `--accent-ink`.

  **`Badge`'s `signal` and `anchor` variants** painted the ramp directly
  (`--signal-100`/`--signal-800`, `--anchor-100`/`--anchor-700`). Those were
  self-consistent fixed pairs at 8.05:1 and 11.84:1 — and still a 94%-light chip
  sitting beside a `default` badge that had inverted properly. They now paint
  `--accent-tint`/`--accent-ink` and `--anchor-tint`/`--anchor-ink`: measured in
  the browser at 8.96:1 light / 8.43:1 dark and 10.23:1 / 9.45:1, with the chip
  now within 1.21:1 of the page in either theme instead of glaring against it.

  Both variants are one ramp step lighter in light mode than before (the 50 step
  rather than 100), which is what makes them share one tint token with every other
  tinted brand surface. Text contrast goes up, not down.

  With that, the exemption list in `component-css.test.mjs` is down to a single
  geometry-only selector: the two badges were the reason it existed, and an
  exemption that outlives its reason is how a sweep goes quiet. `contrast.test.mjs`
  now asserts both tint pairs per theme.

- Updated dependencies [8cc5a0b]
  - @elirobinson/tokens@0.7.0

## 2.1.0

### Minor Changes

- 84aef19: WCAG 2.2 AA conformance across the system, and the tests that keep it.

  `<a class="ds-button ds-button--accent">` rendered amber-on-amber on hover — 2.31:1 in light, 1.00:1 in dark, failing SC 1.4.3. The cause was specificity, not a bad colour: the global `a:hover` is (0,1,1) and beats a (0,1,0) variant class, and the variant's `:hover` only moved `background-color`. Auditing for the same shape turned up 14 more failures, most of them dark-mode only.

  **New tokens.** `--border-control` (3.64:1 / 3.95:1) for control edges, separating them from the now explicitly decorative `--border` and `--border-strong`. `--fg-disabled` (4.85:1 / 7.87:1) for disabled control text, separating it from the decorative `--fg-4`. `--accent-ink` (9.69:1 / 10.17:1) for brand amber a user reads, separating it from the 2.53:1 `--accent` fill. `--status-*-fg` and `--status-*-tint` complete each status set, so a tinted panel's fill and its text always theme together. `--link-on-fill` keeps a link on a filled surface from being repainted by the global `a:hover`.

  **Changed values.** `--link-hover` moves from `--signal-700` to `--signal-800` (5.86:1 to 9.69:1). `--status-success` gains a dark override — forest green was 2.58:1 on a black page.

  **Breaking-ish, in the visual sense.** Component colours change. A filled variant now restates `color` in every state; control edges, disabled text and status text point at the new tokens; and components no longer paint fixed base-scale values (`--ink-*`, `--signal-*`, `--anchor-*`), which is what made a tab underline, a switch track and a tooltip invisible in dark mode. `Rating` draws `★` and `☆` rather than one glyph in two colours — the value was carried by colour alone, which is SC 1.4.1.

  Tailwind consumers get the split through the bridge: `border-control`, `text-foreground-disabled`, `text-accent-ink`, and `bg-*-tint` / `text-*-ink` per status. `border-input` now resolves to `--border-control`.

  **Enforcement.** Three new test layers fail the build rather than documenting the rule: `contrast.mjs`/`contrast.test.mjs` measure every meaningful token against `--bg` in both themes plus the fill/text pairs; `component-css.test.mjs` checks control edges, the restated `color`, and the base-scale ban; `button-contrast.test.mjs` resolves the real cascade over the shipped stylesheets and measures what the label actually renders as. The colour math moved to `@elirobinson/tokens/color` so the gate and the docs cannot disagree.

### Patch Changes

- b963fc1: Fix a checked `Checkbox` disappearing on a dark page, and widen the sweep that should have caught it.

  `.ds-checkbox__input` painted `accent-color: var(--ink-1000)`. `accent-color`
  is what fills the box when a native checkbox is checked, so the checked state
  was pure black in both themes — 1.00:1 against a dark page, the same defect as
  the tab underline and the switch track that the WCAG 2.2 AA pass fixed. It is
  `var(--fg)` now: 21:1 in both themes.

  It survived that pass because `scripts/component-css.test.mjs` matched painted
  properties with a pattern that read the `-color` in `accent-color` as the tail
  of a border property, so the declaration matched nothing and the sweep reported
  the file clean. The property list is now explicit and also covers
  `caret-color`, `outline-color`, `text-decoration-color`, `fill` and `stroke`.
  No other component was painting a base-scale value through one of them.

- Updated dependencies [84aef19]
  - @elirobinson/tokens@0.6.0

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
