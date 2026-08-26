# @elirobinson/react

## 2.5.1

### Patch Changes

- 1fe26ac: Native form controls inherit the page's typeface, so a control's own words stop
  rendering in the UA's Arial.

  `<button>`, `<input>`, `<select>` and `<textarea>` do not inherit `font-family`.
  The UA stylesheet supplies Arial — monospace for `<textarea>` — and five shipped
  controls set `font-size` and nothing else, so each typeset **real words** in a
  different face from the label beside it:

  | control                       | what rendered in Arial      |
  | ----------------------------- | --------------------------- |
  | `.ds-search-field__input`     | **the text the user types** |
  | `.ds-pagination__item`        | page numbers                |
  | `.ds-segmented-control__item` | segment labels              |
  | `.ds-accordion__trigger`      | the trigger's own label     |
  | `.ds-date-picker__day`        | day numbers                 |

  One rule in `tokens.css` fixes all five:

  ```css
  @layer base {
    button,
    input,
    optgroup,
    select,
    textarea {
      font-family: inherit;
    }
    ::file-selector-button {
      font-family: inherit;
    }
  }
  ```

  **Rendered output changes by one typeface and, measured on the real components,
  essentially nothing else.** The only box that moves is
  `.ds-segmented-control__item`, 0.53px wider, because Geist sets its label
  slightly differently from Arial. `.ds-input`, `.ds-textarea`, `.ds-select`,
  `.ds-search-field__input`, `.ds-pagination__item` and `.ds-date-picker__day` are
  unchanged in both axes.

  **Layered**, for the same reason the bare `a` rule is. Unlayered this rule is
  (0,0,1), and unlayered beats every layer regardless of specificity — so it ate a
  consumer's `font-mono` and rendered their button in Geist with no stylesheet of
  their own able to say otherwise. That is issue #112 in a new spelling: a
  bare-element rule that paints must lose to anything stating an intent. Our own
  component rules still win, because `@elirobinson/react` ships them unlayered.

  **`font-family`, not the `font` shorthand, and that is a deliberate departure
  from Tailwind's preflight.** The shorthand also resets `line-height`, which none
  of these controls declares, so it reaches every native control in the system
  rather than the five with the wrong face — measured on the real components:
  `.ds-input` and `.ds-select` 44 → 49.09px, `.ds-textarea` 64 → 72.19px,
  `.ds-accordion__trigger` 44 → 47.09px. The face is the reported bug; the
  line-height is a layout change across most of the library that nobody asked for.

  **What that costs, stated plainly:** preflight resets these elements with the
  shorthand, so a consumer wired the way `tailwind.css` prescribes renders these
  controls with the inherited line-height while this repo's own docs — which ship
  no preflight — do not. That divergence is real, it predates this rule, and this
  rule does not close it. It is accepted knowingly, and
  `form-font-cascade.test.mjs` measures exactly where the two still differ so it
  is recorded rather than forgotten: for a control that states its own font-size —
  which every audited one does — the difference is exactly one property deep, same
  face, same size, same weight, different line-height. For a control that states
  nothing, the shorthand resets size and weight too, so a consumer's bare
  `<textarea>` renders at the UA's 13.33px under our rule and the inherited 16px
  under preflight.

  `::file-selector-button` is a **rule of its own**, not a sixth entry in the
  element list, and it has to stay that way. An unrecognised selector invalidates
  the _entire_ rule it appears in — measured in Chromium: one bogus pseudo-element
  added to a `button, input, …` list sent the button back to the UA's Arial while
  `body` was Georgia. Written as one list, this fix would be silently conditional
  on the engine knowing that one pseudo-element, and would take all five audited
  controls down with it with no error anywhere — the same silent-total shape as the
  `fonts.css` `@import` bug. Preflight ships it in one list because a build step
  compiles it against declared targets; this package hands raw CSS to whatever
  engine a consumer has. The split costs two rules and changes nothing else.

  The selector coverage is preflight's — `<textarea>`, `<optgroup>` and
  `::file-selector-button` included, though none is among the audited five —
  because "which elements fail to inherit" has one answer and it is not the subset
  that happened to have a bug filed. `Textarea` and `Select` are shipped
  components.

  `minor` rather than `patch` because it changes rendered output for anyone
  upgrading: on a 0.x package, `minor` is the breaking lane.

  **Two checks stop this recurring**, and each was confirmed to fail before it was
  trusted green:
  - `packages/tokens/src/form-font-cascade.test.mjs` measures the cascade in a real
    browser — the five faces, the consumer utility that decides the layer, the
    component rules' own `font-size` and `font-weight`, the bounded box movement,
    and the preflight divergence itself. It skips loudly where no Chromium exists.
  - `packages/react/scripts/component-css.test.mjs` adds a static section that runs
    everywhere: the reset is exactly two rules, sits in `@layer base`, uses the
    longhand, keeps the element list free of pseudo-elements, and **covers every
    native form element the components actually render** — read from the TSX, so a
    future `<select>`-based component the reset does not name fails the build
    rather than shipping in Arial.

  A regression to the shorthand now fails in both, which is the point: matching
  preflight is a reasonable-looking edit, and it is one that should be argued
  rather than merged quietly.

  Two existing tests pinned the old layer contents and are updated deliberately
  rather than relaxed: `font-override.test.mjs`'s scope guard now records two
  layered rules instead of one, and `control-affordance.test.mjs` now states its
  real claim directly — nothing in a layer draws an underline except the bare `a`
  rule — instead of inferring it from a one-item roster.

  No component API changes. `@elirobinson/react` carries test-only changes.

- Updated dependencies [1fe26ac]
  - @elirobinson/tokens@0.14.0

## 2.5.0

### Minor Changes

- b0d68d7: Dense affordances are measured against a 24x24 floor instead of being exempted
  from measurement.

  `checkTouchTargets()` used to have two states for a control: measured against
  44x44, or not measured at all. `DENSE_AFFORDANCE_SELECTOR` and
  `data-touch-target="dense"` both did the second thing, so an 8x8 tap target
  carrying the attribute passed as cleanly as a 36px button did. There is now a
  third state, which is the one the contract always meant: **measured, against the
  dense floor.**

  That floor is 24x24 — WCAG 2.2 **AA**, SC 2.5.8 Target Size Minimum, and the
  `--target-min` token. 44x44 is AAA (SC 2.5.5) and this system's stricter
  default, which is what makes a second floor a relaxation to the standard rather
  than a discount off it. A dense control that misses 24x24 is reported under a
  new violation kind, `touch-target-dense`, and every violation now carries
  `contract` and `minimum` so the applied floor is readable without parsing the
  message.

  New exports: `MINIMUM_TOUCH_TARGET_DENSE` (24) and a `denseMinimum` option,
  clamped to `minimum` so a relaxation can never come out stricter than the floor
  it relaxes.

  **This is a breaking change for anyone running these checks.** A consumer who
  wrote `data-touch-target="dense"` on something under 24x24 has a green build
  that goes red on upgrade with no code change of their own. That is the intended
  effect — the attribute meant "stop looking" and now means "held to the
  standard's floor" — but it is an upgrade cost, and it is why this is a `minor`
  rather than a `patch`: on a 0.x package, `minor` is the breaking lane. It is not
  a `major` only because that would mint `1.0.0`, which is a claim about the
  package's overall API stability rather than about this change.

  There is deliberately **no `data-touch-target="none"` escape hatch.** 24x24 is
  the standard's own floor, so below it there is no principled number left to hold
  a control to; and a marker meaning "stop looking" is exactly the suppression
  habit this floor exists to end. The two cases that motivated the question are
  already answered by measurement: a control nothing routes to is reported as
  `touch-target-unmeasurable` rather than passing, and a control whose hit area
  lives on its `<label>` is measured on the label. A page with a genuine exception
  narrows `selector` or widens `exempt` at the call site, where it is visible in
  the test and gets reviewed.

  Two components move to keep the floor honest, and one token rule that was
  already meant to.
  - **`.ds-chip__remove` reaches 24x24 without repainting.** It was the one thing
    the system shipped under the floor: 22x22 painted, 22x22 effective, 2px short
    in both axes. The painted glyph stays 22px — MUI's own delete-icon scale — and
    the hit area now comes from a `--target-min`-sized `::after` centred on the
    control. Sized rather than negatively inset, so it is 24x24 in every condition
    including under `data-platform="mobile"`, and clears the chip label's centre by
    22px. `checkHitAreaOverlap()` reports nothing on it, asserted alongside the
    reach on both a normal and a one-character chip. The overlay is centred with
    negative margins rather than `transform: translate(-50%, -50%)`, so it creates
    no stacking context and hands nothing to the compositor: an overlay that
    changes how the glyph beneath it is rasterised is not a transparent overlay.
  - **The chip's remove glyph is drawn, not typed.** It rendered the literal
    character `×`, which made the control's appearance depend on a font — and on a
    `<button>`, on a font nobody declared: `font-family` is not inherited, the UA
    stylesheet sets it, so the glyph came out in the UA default beside a Geist
    label. Declaring the family fixed the typeface and not the geometry:
    `align-items: center` centres a text node's line _box_, and where the ink
    lands inside it is a property of the family's own metrics. Measured as painted
    pixels, the same declaration centred the UA default's `×` to 0.063px and
    Geist's to 0.875px — neither number designed, and `--font-sans` is a token a
    consumer may re-point, which would move it again.

    A new internal module, `lib/marks.tsx`, draws it as an inline SVG instead:
    `currentColor` so every existing colour state keeps working, `aria-hidden`
    because the button already has its accessible name, sized by a `--mark-size`
    custom property the control sets from the type ramp, and geometry symmetric
    about the viewBox's centre. It is a replaced element centred by the flex box
    the control already declares, so there is no baseline and no metric involved.
    **Measured after: 0.000px from the chip's painted centre, and 0.000px at every
    tenth of a pixel through a full pixel of layout nudging.** The mark paints
    6.75px of ink against the text glyph's 6.00px — deliberately a little
    stronger, and visible in the before/after shots.

    **This changes rendered output.** `Chip`'s remove affordance is a drawn cross
    rather than a typed character; its hit area, its 22px painted box, and every
    number in the touch-target tables are unchanged.

    `.ds-chip` keeps a declared `font-family` — its label is genuinely text, and
    `<button class="ds-chip">` was painting that label in the UA default while
    `<span class="ds-chip">` painted it in Geist.

  - **`.ds-table__sort` gets `min-height: var(--target-min)`.** It is the only
    element in the repo carrying `data-touch-target="dense"`, and it cleared 24 by
    0.45px of inline-box bleed over a 23.09px font-derived box with no
    `min-height` of its own. Stable across 40 subpixel/dpr permutations and still
    a rounding artefact: any header line-height change, or a consumer whose
    fallback font resolved differently, would have turned it red and looked like a
    contract regression. Painted height 23.09px → 24px.
  - **The two halves of the mobile touch floor now agree, and they agree by
    excluding the dense affordances rather than inflating them.** `tokens.css`
    floors controls to 44px twice — under `:root[data-platform="mobile"]` (0,2,1)
    and under `@media (max-width: 480px) and (pointer: coarse)`, which led with a
    bare `button` at (0,0,1) and _lost_ to `.ds-chip` and `.ds-button--sm` (0,1,0).
    So a responsive coarse-pointer phone got a 32px `button.ds-chip` and a 36px
    `--sm` button, while the same page with the attribute set got 44px for both — a
    real divergence between two rules whose own comment calls them "the same
    floor".

    Both halves now carry the same exclusion list, naming exactly the selectors in
    `DENSE_AFFORDANCE_SELECTOR`, so a control the contract measures against 24x24
    is no longer simultaneously stretched to 44px on a phone. A chip stays 32px and
    a `size="sm"` button stays 36px in every condition. Inflating them would have
    discarded the scale they were drawn at (MUI's Chip, shadcn's `sm`) and bought
    nothing the dense floor was not already buying — the dense tier is a
    measurement, not an exemption, and that is the whole premise of this release.

    **This changes rendered output under `data-platform="mobile"` and on
    coarse-pointer phones under 480px**: every dense affordance — a chip's remove
    glyph, a search field's clear, a rating star, a calendar day, a `--sm` button,
    and anything marked `data-touch-target="dense"` — keeps its own height there
    instead of being floored to 44px. Responsive rendering for a chip and a `--sm`
    button is unchanged from before this release; what changed is that the
    `data-platform="mobile"` half now matches it. The two halves are pinned to one
    another, and to `DENSE_AFFORDANCE_SELECTOR`, by tests that fail on drift.

  `.ds-chip` joins `DENSE_AFFORDANCE_SELECTOR`, which closes the separate finding
  that a chip which is a control — `<a class="ds-chip">`, `<button class="ds-chip">`,
  both sanctioned hand-written usages the React `<Chip>` cannot emit — was failing
  the 44px floor latently, for consumers only. 32px is MUI's Chip exactly, which is
  the reference scale this tier already cites, so "a chip is dense" was always the
  right answer; what made it unwritable was that adding it here used to mean
  _stopping measuring it_. Measured now: 64x32 and 63x32, clearing 24 comfortably.
  `Chip` gains no new API and is not resized.

### Patch Changes

- Updated dependencies [b0d68d7]
  - @elirobinson/tokens@0.13.0

## 2.4.0

### Minor Changes

- 9748593: Two residuals from #81, in one package.

  `DecisionCard` gains `headingLevel` (2–6, default 2) and renders `headline` as the
  real heading element. It shipped as a `<p class="ds-decision__headline">`, so the
  card had no title in the document outline and a screen reader's heading navigation
  skipped every DecisionCard on the page. The treatment matches `Accordion`'s — a tag
  map, a runtime fallback for an out-of-range level so a value from outside the type
  boundary cannot throw `Element type is invalid` and take the tree down, and the type
  ramp carried by the class so every level looks identical. The range starts at 2
  where `Accordion`'s starts at 1: an accordion can be the only thing on a page, and a
  card that claimed the document's `<h1>` would be claiming to be the page.

  `ChatMessage`'s avatar frame is now an `Avatar` at its `md` step (40px) instead of a
  hand-rolled 44px box. It carried the comment "44x44 is the floor for an avatar in
  this system"; there is no such floor. `docs/agents/components.md` scopes the 44px
  floor to primary interactive controls, and this frame is `aria-hidden` and
  unfocusable — a decorative mark, on the ordinary avatar scale like every other
  avatar. The element now carries `ds-avatar ds-avatar--md` alongside its own class,
  so the circle's size, fill and radius come from `Avatar.css` and are not restated;
  what stays here is the hairline `--border-control` edge and the mark colour. The
  fill moves with it, from `--surface-2` to `Avatar`'s `--bg-muted`, so the mark
  measures 6.24:1 light / 11.51:1 dark (was 6.66:1 / 11.51:1) and the edge 3.26:1 /
  4.00:1 — both still clear, and both are now measured rather than asserted by name.

  Minor rather than patch: `headingLevel` is an addition to a published prop surface.
  No prop was removed or retyped, and the only behavioural change to existing calls is
  that `headline` is an `<h2>` — which is the fix. The 4px avatar change is visible,
  so it is called out here rather than left for a consumer to discover in a diff.

## 2.3.5

### Patch Changes

- Updated dependencies [8dc024f]
  - @elirobinson/tokens@0.12.1

## 2.3.4

### Patch Changes

- Updated dependencies [74c6645]
  - @elirobinson/tokens@0.12.0

## 2.3.3

### Patch Changes

- b59cdd7: tokens.css: load the webfonts before anything else, and let a utility class colour a link

  Two fixes to the same stylesheet.

  **The `fonts.css` import is now first (#76).** It sat after `palettes.css` and
  `mobile.css`, which is valid in a standalone file because the three are adjacent
  — but every bundler inlines an `@import` in place, so once those two were
  substituted in, real rules preceded the fonts import and the parser discarded
  it. `next build` warned once and shipped a stylesheet with zero `@font-face`
  rules; `next dev` returned a 500. Hoisting it fixes both, and moves no
  declaration relative to any other, because `fonts.css` contains nothing but
  `@font-face`.

  `@elirobinson/tokens/fonts.css` is also exported now, alongside the
  `palettes.css` and `mobile.css` subpaths that were already there. Purely
  additive.

  **The bare `a` rule moved into `@layer base` (#112).** Unlayered, it outranked
  every Tailwind utility — all of which live in `@layer utilities` — so
  `text-accent-foreground`, `text-muted-foreground` and every other `text-*` on an
  anchor silently did nothing, and a teal CTA that had asked in markup for the
  palette's own `--accent-fg` shipped white-on-`#14b8a6` at ~2.1:1. It was not
  fixable from a consumer stylesheet either: an unlayered override of theirs beats
  the utilities too.

  In a layer the rule still does its one job — an anchor nobody has styled is
  coloured and underlined — and now loses to anything that states an intent. No
  token value changed, and nothing in `:root` is layered, so the documented
  `--ds-font-*-override` hook and every other token override behave exactly as
  before.

- Updated dependencies [b59cdd7]
  - @elirobinson/tokens@0.11.1

## 2.3.2

### Patch Changes

- 3371c3a: Fix `Dialog` and `CommandPalette` rendering in the top-left corner under a CSS reset.

  `.ds-dialog` set width, max-width, max-height and padding but no `margin`, so its centring
  came from the UA stylesheet's `dialog { margin: auto }`. A reset's universal `margin: 0` is
  an _author_ rule, and author styles beat the UA at any specificity — so in any app shipping
  one, the margin collapsed and `position: absolute; inset: 0` pinned the dialog to the
  top-left. Tailwind v4's preflight does this; so do normalize-ish resets, sanitize.css, and
  most hand-rolled ones. Reported against Next.js 15 + Tailwind v4 on `@elirobinson/react@2.0.1`.

  `.ds-dialog` now declares `margin: auto` itself, which outranks `*` and is immune to the
  reset. `CommandPalette` renders through `DialogContent` and so is fixed by the same rule —
  it needs no change of its own, and gained none.

  **No action needed on upgrade.** Nothing in your app changes; if you had worked around this
  with a local override such as:

  ```css
  .ds-dialog {
    margin: auto;
  }
  ```

  that override is now redundant and can be deleted.

- Updated dependencies [f549d48]
  - @elirobinson/tokens@0.11.0

## 2.3.1

### Patch Changes

- Updated dependencies [0f09b17]
  - @elirobinson/tokens@0.10.0

## 2.3.0

### Minor Changes

- 8938d09: Split the tokens into three composable dials, and take status and chart colours off the brand.

  `tokens.css` was one file that hardcoded one brand. It is now three layers
  selected by three independent attributes on the root element:

  | Dial     | Attribute                     | Owns                                                                                   |
  | -------- | ----------------------------- | -------------------------------------------------------------------------------------- |
  | Palette  | `data-palette="ember\|slate"` | neutral hue/chroma, `--signal-*`, `--anchor-*`, `--accent*`, `--link*`, `--focus-ring` |
  | Theme    | `data-theme="light\|dark"`    | surfaces, and the re-picked values of all of the above                                 |
  | Platform | `data-platform="mobile"`      | radii, type floors, `--gutter`, control min-height                                     |

  `ember` is the default and its ramps are unchanged, so a consumer that sets no
  attribute renders almost exactly what it rendered before. The exceptions are
  real and are the two sections marked BREAKING below: the status colours moved
  off the brand, and a warning fill now has to be edged.

  ## Migration

  ### 1. Nothing to do for the new files

  `tokens.css` now `@import`s two siblings, `palettes.css` and `mobile.css`.
  Both ship in the package and both are in the `exports` map. If you import the
  stylesheet the normal way there is nothing to change:

  ```css
  @import '@elirobinson/tokens/tokens.css';
  ```

  **But** if your build copies `tokens.css` to a static directory, inlines it, or
  serves it from somewhere the two siblings are not, the imports dangle and the
  page renders with no colour at all. Copy `palettes.css` and `mobile.css`
  alongside it, or flatten the imports. Anything that reads the stylesheet as
  _data_ (a token table, a docs page, a script) must now read both files:

  ```js
  import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
  import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';

  // before: parseTokensCss(readFileSync('…/tokens.css', 'utf8'))
  const tokens = parseTokensCss(readTokenStylesheets(srcDir));
  ```

  `parseTokensCss` accepts an array now. Reading `tokens.css` alone does not
  throw — it silently returns a roster with no brand in it.

  ### 2. `--status-success` and `--status-warning` changed colour — BREAKING

  Status used to be made of brand. `--status-success` was `--anchor-500`
  (forest) and `--status-warning` was `--signal-600` — _the same amber as the
  primary CTA_, so a caution badge sat next to an accent button in the identical
  colour. Both now own their own hue and neither moves with the palette.

  | Token              | Was                   | Is now                   | Measured on `--bg`             |
  | ------------------ | --------------------- | ------------------------ | ------------------------------ |
  | `--status-success` | `var(--anchor-500)`   | `oklch(51.9% 0.145 150)` | 5.17:1 light, 4.06:1 dark      |
  | `--status-warning` | `var(--signal-600)`   | `oklch(80.25% 0.16 85)`  | **1.87:1** light, 11.22:1 dark |
  | `--status-danger`  | `oklch(58% 0.22 25)`  | `oklch(54.85% 0.2 27)`   | 5.41:1 light, 3.88:1 dark      |
  | `--status-info`    | `oklch(60% 0.13 240)` | `oklch(54% 0.155 250)`   | 5.06:1 light, 4.15:1 dark      |

  If you were relying on success being forest green or warning being brand
  amber — for instance to make a badge match a button — that is the coupling
  this change removes. Use `--anchor` or `--accent` explicitly if you wanted the
  brand colour; use the status token if you wanted the status.

  ### 3. A warning fill or rule must now be edged — BREAKING

  `--status-warning` is **1.87:1** and cannot be drawn bare. Yellow that clears
  3:1 on white is olive, which is not a caution colour, so the floor is carried
  by a separate token:

  ```css
  /* before */
  .my-callout {
    border-color: var(--status-warning);
  }

  /* after */
  .my-callout {
    border-color: var(--status-warning-border);
  } /* 3.76:1 light, 11.22:1 dark */
  ```

  Every place you paint `--status-warning` as a stripe, a rule, a dot or a fill
  edge, swap in `--status-warning-border`. The fill itself is still
  `--status-warning`, but it needs the border around it. This is the only status
  state with the asymmetry — success, danger and info clear 3:1 as bare fills in
  both themes.

  ### 4. Two new members per status state

  Each state now has five tokens instead of three:
  - `--status-X` — the fill. Never text.
  - `--status-X-on` — **new**, the text drawn _on_ that fill. 5.17 / 11.22 / 5.41 / 5.06.
  - `--status-X-fg` — status text on `--bg` / `--surface`.
  - `--status-X-tint` — the quiet panel background.
  - `--status-X-tint-edge` — **new**, that panel's hairline.

  If you were drawing a label on a status fill and reaching for `--fg-inverse`
  or `--fg-on-signal`, replace it with `--status-X-on`.

  Neither of the old choices can be right in both themes, because both move
  while the fill under them does not. `--fg-inverse` is white in light and black
  in dark; on the previous token set that already failed two cells —
  `text-info-foreground` on `bg-info` at **3.88:1** in light, and
  `text-destructive-foreground` on `bg-destructive` at **4.38:1** in dark. With
  the status hues re-picked in this release it would have failed three different
  cells instead (success 4.06, danger 3.88, info 4.15, all in dark) while fixing
  light — trading one theme's failures for the other's.

  `--fg-on-signal` is the second half and was latent rather than live: it
  resolves to `--accent-fg`, which is ink under `ember` and white under `slate`,
  so a warning label on the 1.87:1 yellow fill drops to **1.87:1** as soon as a
  second palette exists. One palette hid it.

  `--status-X-on` is the token measured against the fill it is drawn on, and it
  holds at 5.17 / 11.22 / 5.41 / 5.06 in all four palette x theme combinations.
  The Tailwind bridge's `--color-*-foreground` aliases are repointed to it, so
  if you use `text-success-foreground`, `text-warning-foreground`,
  `text-destructive-foreground` or `text-info-foreground`, their rendered colour
  changes and the pairing now holds in every cell.

  If you use `bg-*-tint`, `border-*-tint-edge` is the hairline that goes with it.

  ### 5. New: eight categorical chart colours

  `--chart-1` … `--chart-8`, plus `--chart-grid` and `--chart-axis`. Eight hues
  at one lightness and one chroma so no series shouts louder than another,
  ordered so consecutive slots are at least 90° apart. Palette-independent: a
  chart does not restyle itself when the brand does. Light 3.34–3.90:1 (fills
  and strokes only), dark 8.61–9.59:1 (which also clears 4.5:1 for in-chart
  labels). A legend still needs a label or a shape — colour is never the only
  channel (SC 1.4.1). Tailwind: `bg-chart-1` … `text-chart-8`.

  ### 6. New: targets, safe areas, scrim

  `--target-min: 24px` (the SC 2.5.8 floor), `--target: 44px`,
  `--target-lg: 56px`; `--safe-t` / `-r` / `-b` / `-l` reading `env(safe-area-inset-*)`;
  and `--scrim` for the wash behind a modal (0.56 light, 0.72 dark). Tailwind
  gets `min-h-target`, `size-target-min`, `bg-scrim`. The safe-area tokens are
  deliberately not aliased into a utility — an inset is added to an existing
  pad, not substituted for it, so write
  `pb-[calc(var(--space-4)+var(--safe-b))]`.

  `[data-platform="mobile"]` raises every `button`, `[role="button"]`,
  `a.ds-button`, `input:not([type='range'])` and `select` to 44px, and coarsens
  radii and the small end of the type ramp. It changes **no colour**, so every
  measured ratio still holds on a phone.

  ### 7. `--n-h` / `--n-mult`, and where a token override goes

  The neutral ramp is mixed from two palette-owned dials —
  `oklch(<L>% calc(<C> * var(--n-mult)) var(--n-h))`. Lightness is untouched by
  either, and lightness is what carries contrast, so a palette can take the greys
  from near-achromatic to charcoal without moving a measured neutral ratio. That
  is asserted, not assumed: across every neutral foreground on every neutral
  surface in both themes, the largest disagreement between the two palettes is
  0.003:1, which is two orders of magnitude below the gap between any two WCAG
  thresholds. If you have your own greys, this is the mechanism to copy — put
  them on the same two dials rather than declaring a second ramp.

  If you override tokens in your own `:root`, note that `palettes.css` and
  `mobile.css` are `@import`ed _before_ `tokens.css`'s own declarations, and a
  bare `[data-*]` selector ties with `:root` at (0,1,0). Your own unlayered
  `:root` block still wins over all of it, as before. But if you were overriding
  a brand token by re-declaring the ramp step it points at, point at the
  semantic token instead — the ramps are the palette's now.

  ### 8. `::selection` and `--fg-on-signal`

  `::selection` hardcoded `--signal-500` with ink text, which is amber under
  every palette and the wrong foreground under half of them. It is
  `var(--accent)` / `var(--accent-fg)` now. `--fg-on-signal` is kept as a
  documented alias of `--accent-fg`; new code should use `--accent-fg`.

  ## Verification

  `contrast.test.mjs` now sweeps **palette × theme** — four combinations, not
  two — and asserts three things a two-theme sweep could not see: that every
  `--status-*` and `--chart-*` resolves identically under both palettes, that
  every neutral measures identically under both, and that no block declares a
  token under a selector the resolver does not understand. The two un-inverted
  brand tints (`--accent-tint` / `--anchor-tint` sat at the `50` step in dark
  mode, a 97%-light chip on a black page) are fixed and would now fail the
  build. The exception for `--status-warning` is written into `CONTRAST_RULES`'
  `except` map with its reason and is asserted from both sides: the fill under
  3:1, and `--status-warning-border` over it.

### Patch Changes

- Updated dependencies [8938d09]
  - @elirobinson/tokens@0.9.0

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
