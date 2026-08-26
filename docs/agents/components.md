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
- **ai/** — surfaces that only mean anything inside an assistant interaction (e.g. `ChatThread`, `StreamingCaret`).

Boundary rule: if a component renders into a portal, traps focus, or manages open/closed state across multiple sub-elements, it's an organism. If it's assembled from 2+ atoms with no such orchestration, it's a molecule. Otherwise it's an atom.

### Why `ai` is a tier and not a fourth size

The other three tiers answer "how much is assembled here." `ai` answers a different
question — "what is this for" — and it is deliberately the only tier that does. A component
belongs in `ai/` when **it has no meaning outside an assistant surface**: a turn-taking
message log, a token-by-token streaming affordance. `StreamingCaret` is atom-shaped and
`ChatThread` is molecule-shaped, and neither placement would have told a reader the thing
they need to know, which is that these encode assumptions about generated, incremental,
non-deterministic content.

Two consequences, both of them checks rather than advice:

- **The test is the domain, not the shape.** A card that happens to render a model's output
  is still a `Card`. A verdict marker that happens to be produced by a model is still a
  molecule — `VerdictBadge` and `DecisionCard` live in `molecules/` and `organisms/` for
  exactly that reason, even though they were designed for an assistant product. If you can
  describe the component without saying "assistant," "model," or "streaming," it is not an
  `ai` component.
- **`ai/` inherits every other constraint unchanged.** Same `ds-` classes, same token
  rules, same `forwardRef` requirement, same touch targets, same contrast contract. Being a
  new tier buys a directory and nothing else.

The tier is derived, not declared: `packages/react/scripts/manifest.mjs` reads the
directory segments under `src/components`, so `ai` reaches the manifest, the `ds` CLI, the
MCP server, and the docs sidebar without any of them being told about it. The one place a
new tier is not free is `apps/docs/src/lib/editorial.ts`, whose `TIER_INTRO` map is
hand-written prose and whose key set is asserted equal to the manifest's tier set.

## Styles

Each component's CSS lives next to it (`components/<tier>/<Name>.css`).
`packages/react/src/styles.css` is the aggregate entry point that `@import`s them
all in cascade order — keep that order stable when adding a file. Consumers
import either the aggregate (`@elirobinson/react/styles.css`) or a single
component's sheet (`@elirobinson/react/styles/<tier>/<Name>.css`).

## Shared interaction hooks

Prefer these over re-implementing keyboard behaviour in a component:

- **`useActiveDescendant`** — the `aria-activedescendant` listbox pattern: DOM
  focus stays on an input while a highlighted option is tracked by id. Owns the
  index-clamping invariant (filtering must never leave the highlight pointing at
  a removed option). Used by `Combobox` and `CommandPalette`.
- **`useRovingFocus`** — arrow/Home/End traversal for widgets exposing a single
  tab stop. The caller decides what a move _means_ via `onNavigate` (tabs move
  focus only; radio-style groups also select). Used by `Tabs` and
  `SegmentedControl`.

Import via the tiered subpath: `@elirobinson/react/components/<tier>/<Name>`.

### Constraints (all components, all tiers)

- Every component that renders a focusable/interactive native element uses `forwardRef`, forwarding to the outermost interactive/native element the component owns.
- Touch targets are scoped by control role, not one blanket size:
  - **Primary interactive controls at their default size** — buttons, pagination items, segmented-control options, nav items, and other button-like controls — have a minimum 44x44 touch target. Where visual density matters, keep the painted glyph small and expand the hit area (padding, or a bounded overlay) rather than inflating the visible control.
  - **Dense inline affordances** — a chip's remove glyph, a search field's clear button, rating stars, calendar day cells — follow shadcn/MUI-scale sizing instead, and are measured against a **24x24** floor rather than 44x44. Reference values: MUI Chip is 32px tall (24px `small`) with a 22px (16px `small`) delete icon; shadcn Badge is ~20px tall with 12px icons and ships no remove affordance at all.
  - **An explicitly compact size variant follows the dense scale too.** `Button`'s `size="sm"` is 36px and is meant to be — see "Why `size=\"sm\"` is 36px" below. `checkTouchTargets()` tiers `.ds-button--sm` by class, so both `<Button size="sm">` and a hand-written `<a class="ds-button ds-button--sm">` land on the dense floor without anyone hand-adding `data-touch-target="dense"`. The same is true of `.ds-chip`: a chip that is a control (`<a class="ds-chip">`, `<button class="ds-chip">`) is 32px, which is MUI's Chip exactly.
  - **Dense is a second floor, not an exemption.** A control matching the dense tier is still measured; it is measured against 24x24 (WCAG 2.2 **AA**, SC 2.5.8 Target Size Minimum) and a miss is reported under `touch-target-dense`. There is no tier below that and no `data-touch-target="none"` — see "Why there is no third tier" below.
  - **A decorative mark is not a touch target at all.** An `aria-hidden`, unfocusable mark — a chat avatar, a status dot, an eyebrow glyph — has no hit area to size, so neither rule applies to it and it takes the ordinary size scale for its kind. Avatars are 32/40/56 (`Avatar`'s `sm`/`md`/`lg`) and nothing else. `ChatMessage` once hand-rolled a 44px avatar on the claim that "44x44 is the floor for an avatar in this system"; there is no such floor, and the 44px above is scoped to primary interactive controls. If a mark ever does need a new size, add the step to `Avatar` — do not draw one beside it.
  - **In every case**, an expanded hit area must never overlap sibling content. A 44x44 overlay on a chip once covered the chip's own label, so clicking the label's tail fired the remove handler — bound the hit area (e.g. stretch to the container's height, not a symmetric negative inset) so this can't recur. `.ds-chip__remove` is the worked example: it paints 22px and reaches 24x24 through a `--target-min`-sized `::after` centred on the glyph, which clears the label's centre by 22px.
- **A filled variant restates `color` in every state.** If a rule sets `background-color`, the rule for each of its states (`:hover`, `:active`, `:focus`, `:disabled`) sets `color` too — even when the colour does not change.
- **Never paint `--ink-*`, `--signal-*` or `--anchor-*`.** The scales are fixed and do not respond to `[data-theme="dark"]`; use the semantic token that flips. `component-css.test.mjs` enforces this.
- **A background and the text on it come from the same world** — both themed, or both fixed. One of each inverts in dark mode.
- Control edges use `--border-control`, not `--border`/`--border-strong` — enforced by `component-css.test.mjs` here and shipped to consumers as `@elirobinson-css/no-decorative-control-edge`. See [Tokens](tokens.md) for which edges count.
- Status text uses `--status-*-fg`, status panels `--status-*-tint`; `--status-*` is a fill and two of them cannot carry a label at all.
- Brand amber that a user reads is `--accent-ink`, not `--accent` (2.53:1).
- **Colour is never the only signal for a state.** Pair it with a glyph, shape, label or border — see SC 1.4.1 in [Tokens](tokens.md).

#### Why `size="sm"` is 36px

`.ds-button--sm` is 36px tall and `checkTouchTargets()`'s floor is 44px, so the
system's own small button used to fail the system's own contract (issue #113).
Neither remediation the error message offered was correct: padding it to 44px
turns an `sm` into an `md`, and hand-adding `data-touch-target="dense"` to a
header CTA teaches consumers to suppress the contract. `sm` stays 36px and the
contract now recognises it. The reasoning:

1. **36px is above the standard, below our floor.** WCAG 2.2 **AA** (SC 2.5.8,
   Target Size Minimum) asks for 24x24 CSS px. 44x44 is **AAA** (SC 2.5.5).
   A 36px control clears AA with margin — it is under _this system's_ stricter
   self-imposed default, not under the standard.
2. **44px would delete the variant.** Raised to 44, `sm` would differ from `md`
   only in font size and horizontal padding. That is a typography variant, not
   a size variant. Anyone who genuinely needs a compact control would then
   hand-roll one outside the system, which is worse for the system's coverage
   than a sanctioned 36px button.
3. **The two-tier contract was not the problem.** `touch-target-primary` and
   `touch-target-dense` are both right; the gap was that `size="sm"` had no way
   to say which tier it belonged to.

The exemption is keyed off `.ds-button--sm`, **not** off a React prop. The
element that failed in the wild was `a.ds-button.ds-button--accent.ds-button--sm`
— an anchor carrying the classes, which is a supported usage — so anything
`Button.tsx` emitted for `size="sm"` would have missed it entirely.

The cost #113 stated so it would not be rediscovered — a consumer who reaches
for `size="sm"` for a page's primary mobile action gets a silent pass — is what
issue #116 answered: dense controls are now held to a _dense floor_ (WCAG's
24px) rather than exempted from measurement. `size="sm"` is still not measured
against 44x44, and whether a 36px control is the right thing for a page's
primary action is still a judgement the contract cannot make; what changed is
that `data-touch-target="dense"` on an 8x8 glyph no longer passes as cleanly as
a 36px button does.

#### Why there is no third tier

Issue #116 asked whether a `data-touch-target="none"` escape hatch should exist
for controls that genuinely cannot be measured. It does not, and should not:

1. **24x24 is the standard's own floor.** Below it there is no principled
   number left to hold a control to, so an opt-out would not be a third tier —
   it would be the absence of one.
2. **A marker that means "stop looking" is the suppression habit #113 was filed
   about.** That is the failure this floor exists to end; shipping the escape
   hatch alongside it would hand back what the floor just took away, and it
   would be reached for first because it is the quickest way to a green build.
3. **Both motivating cases are already handled by measurement.** A control
   nothing routes to is reported as `touch-target-unmeasurable` — a stated gap
   in the check, not a pass. A control whose hit area lives on its `<label>` is
   measured on the label.

A page with a genuine exception narrows `selector` or widens `exempt` at the
call site, where the exception is visible in the test and gets reviewed, rather
than in an attribute on an element nobody reads again.

#### Why a filled variant restates `color`

It reads as redundant and is not — it is a specificity fact, not a style preference.

`tokens.css` declares a global `a:hover { color: var(--link-hover) }`. That selector is **(0,1,1)**. A variant class like `.ds-button--accent` is **(0,1,0)**, so it loses. `<a class="ds-button ds-button--accent">` is a real and encouraged usage, and when the variant's own `:hover` rule moved only `background-color`, the fill stayed amber while the element rule repainted the label amber: **2.31:1**, failing SC 1.4.3. Nothing in the component library outranked it.

Two layers fix it, and both are needed:

1. `.ds-button--accent:hover` restating `color` is **(0,2,0)**, which wins. This is the component's job and applies to every filled variant.
2. `tokens.css` scopes `--link-on-fill: currentColor` onto links inside filled surfaces (`.ds-button a`, `.ds-badge a`, `.ds-chip a`, `.ds-alert a`, `.ds-toast a`, `[data-on-fill] a`), so a link _nested inside_ a fill inherits that fill's foreground rather than a hue shift. Mark any new filled surface with `data-on-fill` or add its class there.

Both layers are measured rather than asserted. `component-css.test.mjs` checks the _mechanism_ — that every state rule painting a background also declares `color`. `button-contrast.test.mjs` checks the _outcome_: it loads `tokens.css` plus `Button.css` into jsdom, resolves the real cascade for an `<a class="ds-button ds-button--*">` in every variant, both themes, resting/hovered/pressed, and measures what the winning declaration actually paints against the fill underneath it. A `color` that loses the cascade satisfies the first and fails the second, which is exactly what the reported bug was. `--accent` is the variant that was reported and the mildest case — `--link-hover` on `.ds-button--primary:hover`'s `--fg-2` fill is 1.15:1 in light. Disabled is measured to 3:1 rather than 4.5:1: SC 1.4.3 excludes text in an inactive component, but a disabled label nobody can see is still a defect.

Because the hover hue shift is gone on those surfaces, the hover affordance is carried by `text-decoration-thickness: 2px` instead. A control that is an anchor (`a.ds-button`, `a.ds-chip`) drops the underline entirely — it is a control, not a link.

That last sentence is a check, not advice. `component-css.test.mjs` sweeps every component stylesheet for a `text-decoration: underline`, and `control-affordance.test.mjs` resolves the real cascade over `tokens.css` plus the component sheets and asserts the declaration that _wins_ is not one — a `text-decoration: none` that loses to a more specific rule satisfies the first and not the second. Consumers get the same constraint as `@elirobinson-css/no-underlined-control-label` from `@elirobinson/eslint-config/css`.

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

19 components were added in this expansion. Import them via the tiered subpath
(`@elirobinson/react/components/<tier>/<Name>`, see above).

| Component                       | Tier      | Notes                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RadioGroup` / `RadioGroupItem` | atoms     | Context-based radio group; `RadioGroupItemProps` omits `checked`/`onChange`/`name` since the group owns them.                                                                                                                                                                                                                                                                             |
| `Spinner`                       | atoms     | `role="status"` loading indicator; `size` (`sm`/`md`/`lg`) and `label` (default `"Loading"`).                                                                                                                                                                                                                                                                                             |
| `Slider`                        | atoms     | Labelled native `<input type="range">`; `label` is required, matching `Input`/`Textarea`/`Select`.                                                                                                                                                                                                                                                                                        |
| `Kbd`                           | atoms     | Styled `<kbd>` for keyboard-shortcut hints; used by `CommandPalette`.                                                                                                                                                                                                                                                                                                                     |
| `Chip`                          | molecules | Optional `onRemove` renders a dense inline remove button: 22px painted, 24x24 hit area. A chip that is a control (`<a class="ds-chip">`) is dense too — see Constraints above.                                                                                                                                                                                                            |
| `FormField`                     | molecules | See "FormField vs Input" above.                                                                                                                                                                                                                                                                                                                                                           |
| `SearchField`                   | molecules | `type="search"` input with a built-in clear button; `value`/`onValueChange` (controlled) or `defaultValue` (uncontrolled).                                                                                                                                                                                                                                                                |
| `Pagination`                    | molecules | `page`/`pageCount`/`onPageChange`; renders one button per page — no windowing for very large page counts (fine for typical use, flagged as a follow-up for 100+ pages).                                                                                                                                                                                                                   |
| `Stepper`                       | molecules | `steps` (`{ label }[]`) + `activeStep`; ordered-list progress indicator.                                                                                                                                                                                                                                                                                                                  |
| `SegmentedControl`              | molecules | `role="radiogroup"`/`role="radio"` option group with roving-tabindex arrow-key navigation; a primary control, so it keeps the 44px touch target.                                                                                                                                                                                                                                          |
| `EmptyState`                    | molecules | `title` + optional `description`/`icon`/`action`; used by `Table`'s empty-rows branch.                                                                                                                                                                                                                                                                                                    |
| `Rating`                        | molecules | Read-only (`role="img"`) when `onValueChange` is omitted; interactive star buttons otherwise (dense inline sizing, not 44px).                                                                                                                                                                                                                                                             |
| `VirtualList`                   | organisms | Generic windowed list wrapping `@tanstack/react-virtual`; `items`/`estimateSize`/`renderItem`/`height`/`overscan`. Its ref resolves to a `VirtualListHandle` exposing `scrollToIndex`, not the DOM node. Composed by `VirtualTable` and `Combobox`.                                                                                                                                       |
| `Accordion`                     | organisms | Compound `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`; `headingLevel` (1-6, default 3) with a runtime fallback for out-of-range values.                                                                                                                                                                                                                              |
| `DatePicker`                    | organisms | Popover date grid (`role="grid"`/`row`/`gridcell`, dense day-cell sizing); `label` required, `value`/`onValueChange`.                                                                                                                                                                                                                                                                     |
| `Combobox`                      | organisms | Filterable single-select combobox following the WAI-ARIA combobox-with-listbox-popup pattern; its option list is windowed via `VirtualList` once open.                                                                                                                                                                                                                                    |
| `Table`                         | organisms | Paginated data table built on `@tanstack/react-table`'s row models (not hand-rolled pagination); `data`/`columns` (`ColumnDef<T>`, re-exported from this module) + `pageSize`.                                                                                                                                                                                                            |
| `VirtualTable`                  | organisms | Windowed sibling of `Table` for large row counts: same columns/sorting/filtering, but renders an ARIA `role="table"` grid via `VirtualList` instead of a paginated `<table>`. Shared logic lives in `organisms/table/core`.                                                                                                                                                               |
| `NavigationMenu`                | organisms | Always-rendered nested link list — no collapse/disclosure state; `items` (`{ label, href?, items? }[]`) + `currentPath`. An item with an `href` is a real `<a>`; omitting `href` renders an inert `<span>` group label (never focusable, never `aria-current`) that names its nested list via `aria-labelledby` — don't hand a section header its first child's href to satisfy the type. |
| `CommandPalette`                | organisms | `Dialog`/`DialogContent`/`DialogTitle`-backed command list with a filterable `SearchField` and `Kbd` shortcut hints; `open`/`onOpenChange`/`commands`.                                                                                                                                                                                                                                    |

**A note on `NavigationMenu` and layout patterns:** `docs/agents/layout-patterns.md`
does not reference a "nav-item-list primitive," despite an earlier planning
document's claim that it does. That file only covers app-specific layout
compositions (Header, Footer, Hero, Sidebar, TopBar, StatCard) and doesn't
discuss nav-item lists at all, so no genuine cross-reference exists to add.
Left as-is rather than inventing one.

## Decision and assistant surfaces

Ported up from a product built on this system, where every one of them had been hand-built
because the library had no equivalent. Import them via the tiered subpath
(`@elirobinson/react/components/<tier>/<Name>`, see above).

| Tier      | Export           | Notes                                                                                                                                                                                                                                                                                                                                           |
| --------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ai        | `ChatThread`     | `role="log"`, `aria-live="polite"`, `aria-relevant="additions text"`. `label` is required — the accessible name is a prop, never copy in the component. `announce={false}` sets `aria-live="off"` for a closed or replayed thread.                                                                                                              |
| ai        | `ChatMessage`    | One turn. `avatar` is a **required** node — there is no role-derived fallback — framed by `ds-avatar ds-avatar--md`, so the circle is an `Avatar` and not a size of ChatMessage's own. `actions` is a node, not an `[{ label, onClick }]` array. `variant` is `sent` \| `received`; a sent turn reads as settled via `--fg-2`, never `opacity`. |
| ai        | `StreamingCaret` | Returns `null` when `active` is false, so it cannot be left mounted on a finished message. `label` promotes it to `role="status"`; without one it is `aria-hidden`. Honours `prefers-reduced-motion`.                                                                                                                                           |
| molecules | `VerdictBadge`   | A decision marker that survives both themes. Carries a glyph **and** a word — `Badge` has no state that does either. The glyph is `aria-hidden`; the word is the accessible text.                                                                                                                                                               |
| molecules | `StubCard`       | A summary that reads as a ticket stub: a body column plus a perforated stub column. The perforation is structure, so it is a dashed `--border-control`.                                                                                                                                                                                         |
| organisms | `DecisionCard`   | A headline verdict, figures broken out by `kind`, a contrast figure, a caveat, and a **conditional** action. Composes `VerdictBadge`. `headline` is a real heading element — `headingLevel` is 2–6, default 2. See the footer guarantee below.                                                                                                  |

### `DecisionCard` renders no footer when there is no action

This is a product guarantee, not a style choice, and it has its own test.

When `action` is absent, `DecisionCard` renders **no `.ds-decision__foot` element at all** —
not a disabled button, not a hidden one, nothing. A decision surface that can render a
"pay now" control under a "do not buy" verdict is one CSS bug away from taking a user's
money against its own advice, and a disabled button is exactly that bug waiting for a
stylesheet to lose. `closing` renders in the body instead.

`DecisionCard.test.tsx` asserts both halves: no button in the accessible tree, and no
`.ds-decision__foot` in the DOM.

### Naming

`DecisionCard` is named for the shape, not for what a product happens to put in it: a
verdict, figures broken out by kind, a contrast figure, a caveat, a conditional action.
That shape is a quote, an eligibility result, or a risk assessment just as readily as it is
a recommendation. `kind` on a figure renders as `data-kind` rather than a class from a
fixed enum, so a product can group its figures without the system having to learn the
product's vocabulary.

### Product theming

`ChatMessage`, `StreamingCaret` and `VerdictBadge` read the optional
product token layer (`DecisionCard` inherits it through the `VerdictBadge` it composes) — see [Product token layer](product-token-layer.md). Every read falls
back to a system token, so the layer is always optional and Miltinson Amber stays the
default. Which components read it is derivable
(`grep -r 'var(--product-' packages/react/src`), so treat that sentence as a pointer, not
as the register.

## shadcn → Miltinson mapping reference

| shadcn component                                         | Miltinson equivalent / notes                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Badge                                                    | `Badge` — maps to preview tags (default, signal, anchor, solid, outline)                                                                                            |
| Button                                                   | `Button` — primary, accent, secondary, ghost; sm/md/lg sizes. `sm` is 36px, a sanctioned dense variant matching shadcn's own `sm` — see "Why `size=\"sm\"` is 36px" |
| Card                                                     | `Card` + subcomponents — matches preview portfolio cards                                                                                                            |
| Input, Textarea, Select, Label                           | Form primitives — match `components-fields.html` preview                                                                                                            |
| Alert                                                    | `Alert` — status tokens for success/warning/danger/info                                                                                                             |
| Separator                                                | `Separator` — `--border` hairline                                                                                                                                   |
| Tabs                                                     | `Tabs` — ink underline active state                                                                                                                                 |
| Dialog                                                   | `Dialog` — native `<dialog>` with token surfaces                                                                                                                    |
| DropdownMenu, Popover, Tooltip, Sheet, Toast             | Overlay primitives — portal positioning, keyboard nav, aria-live toasts                                                                                             |
| Avatar, Breadcrumb, Checkbox, Switch, Skeleton, Progress | Styled per tokens; check UI kits for context                                                                                                                        |
| Eyebrow, RuleLink                                        | Marketing typography primitives from ui_kits                                                                                                                        |
| RadioGroup                                               | `RadioGroup` / `RadioGroupItem` — context-based group, native radios                                                                                                |
| Slider                                                   | `Slider` — labelled native `<input type="range">`                                                                                                                   |
| Pagination                                               | `Pagination` — page-button list, `aria-current="page"`                                                                                                              |
| Accordion                                                | `Accordion` — compound, configurable heading level                                                                                                                  |
| Calendar / Date Picker                                   | `DatePicker` — popover date grid, ARIA `grid`/`row`/`gridcell`                                                                                                      |
| Combobox                                                 | `Combobox` — filterable listbox popup, virtualized option list                                                                                                      |
| Data Table (TanStack Table recipe)                       | `Table` (paginated) / `VirtualTable` (windowed) — `@tanstack/react-table` row models                                                                                |
| NavigationMenu                                           | `NavigationMenu` — simplified: always-rendered nested list, no submenu disclosure/triggers                                                                          |
| Command (cmdk)                                           | `CommandPalette` — built on this repo's `Dialog`, not the `cmdk` library                                                                                            |
| Kbd (registry component)                                 | `Kbd` — styled `<kbd>`, used for shortcut hints                                                                                                                     |
| Badge (removable variant)                                | `Chip` — shadcn ships no removable badge; sized to the MUI/shadcn dense scale                                                                                       |
| Toggle Group                                             | `SegmentedControl` — closest shadcn analog; a primary control, keeps the 44px target                                                                                |
| Form / FormField (react-hook-form)                       | `FormField` — same render-prop-to-a11y-bundle idea, not bound to react-hook-form                                                                                    |
| —                                                        | `SearchField`, `Stepper`, `EmptyState`, `Rating`, `VirtualList` — no direct shadcn primitive; local patterns (see "New components" above)                           |
| —                                                        | `VerdictBadge` — no shadcn primitive; a decision marker carrying a glyph and a word, so the verdict is never colour alone                                           |
| —                                                        | `StubCard` — no shadcn primitive; a body column beside a perforated stub column, the perforation drawn as a dashed `--border-control`                               |
| —                                                        | `DecisionCard` — no shadcn primitive; a verdict, its figures, and an action that does not exist when the verdict allows none                                        |
| —                                                        | `ChatThread` — no shadcn primitive; the `role="log"` live region for a conversation, with the accessible name as a required prop                                    |
| —                                                        | `ChatMessage` — no shadcn primitive; one turn, avatar and attribution and body in one grid                                                                          |
| —                                                        | `StreamingCaret` — no shadcn primitive; an infinite blink, so it carries its own `prefers-reduced-motion` rule rather than the global clamp                         |
