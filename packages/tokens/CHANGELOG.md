# @elirobinson/tokens

## 0.13.0

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

## 0.12.1

### Patch Changes

- 8dc024f: Stop the browser test suites failing on teardown alone.

  `preflight-sweep.test.mjs` mirrored `playwright.test.mjs`'s browser bootstrap by
  hand and lost two things in the copy: the explicit budget on `afterAll`, which
  left `browser.close()` on Vitest's 10s default and failed the file roughly one
  run in three under load with all four of its tests already passing, and the
  loud skip, which meant a browser that never launched skipped the suite silently
  and orphaned a late-arriving Chromium.

  Both suites now boot from one `browser.test-helper.mjs`, which owns the budget
  and registers the teardown itself, so a suite cannot forget it. The helper is
  excluded from the published package. No consumer-facing behaviour changes; the
  `@elirobinson/tokens` bump is a comment in `link-cascade.test.mjs` that pointed
  at where the budget's reasoning used to live.

## 0.12.0

### Minor Changes

- 74c6645: Make the three dials queryable — a command, an MCP tool, and a roster you can import.

  The palette/theme/platform split shipped the dials but left them undiscoverable.
  Nothing you could run reported that `data-palette` or `data-platform` existed,
  `ds tokens` printed one value per token where four exist, and the MCP server
  answered for `ember/light` without saying so. The only way to learn the system
  had three dials was to read our stylesheets — which is prose you would have had
  to copy into your own docs, and wrong the day a third palette ships.

  ## `ds dials` — new

  ```
  $ ds dials

  DIALS  3 attributes on the root element; an absent attribute is the default

    palette   data-palette   ember (default)  slate
              40 tokens — the brand — neutral hue and chroma, --signal-*, --anchor-*, --accent*, --link*, --focus-ring

    theme     data-theme     light (default)  dark
              62 tokens — surfaces and text, and the re-picked value of everything the palette owns

    platform  data-platform  desktop (default)  mobile
              12 tokens — geometry only — radii, the small end of the type ramp, --gutter, the narrow containers. No colour.

  COMBINATIONS (4)  palette x theme — the dials that move colour
    ember/light  (no attributes — this is the default)
    ember/dark   data-theme="dark"
    slate/light  data-palette="slate"
    slate/dark   data-palette="slate" data-theme="dark"

  PLATFORM  data-platform="mobile" re-points 12 of 196 tokens, on top of all 4 combinations
    each row is the desktop value -> the mobile value

    --radius-sm     4px -> 8px
    --gutter        max(20px, round(4vw, 4px)) -> 16px
    ...
  ```

  Every row is derived from the installed package. Add a palette and this command
  reports it on a version bump, with nothing to edit.

  ## `ds tokens` reports every combination — BEHAVIOUR CHANGE

  A token that resolves the same everywhere still prints as one value. A token
  that does not now prints one labelled row per combination, and any token the
  platform layer re-points gets its override appended:

  ```
  $ ds tokens status-success

    --status-success            oklch(51.9% 0.145 150)
    --status-success-fg
      ember/light               oklch(44% 0.12 150)
      ember/dark                oklch(78% 0.13 150)
      slate/light               oklch(44% 0.12 150)
      slate/dark                oklch(78% 0.13 150)

  $ ds tokens radius-sm

    --radius-sm  4px
      [data-platform="mobile"]  8px
  ```

  Two things changed for anything parsing this output. Values are now **resolved**
  — a `var()` chain is followed to what it lands on, so `--accent` prints
  `oklch(72.5% 0.175 65)` rather than `var(--signal-500)`. And a varying token's
  values are indented under its name instead of sitting on the same line. If you
  scrape `ds tokens`, read `ds dials` first and expect both shapes.

  Against a `@elirobinson/tokens` older than this release, `ds tokens` prints what
  it always did plus a line naming the upgrade — it does not fail.

  ## MCP: `get_dials`, and `search_tokens` names its combination

  `get_dials` reports the roster, the combinations with the attributes that select
  each, and the platform overrides. `search_tokens` applies the same printing rule
  as the CLI and opens with the default combination, so an agent can no longer
  read a value without being told which combination it belongs to.

  Also fixed: `search_tokens` could not find `--scrim` or `--target`. The family
  matcher required a trailing hyphen, so both were missing from the `Prefixes:`
  list a failed search suggests — `{prefix: 'scrim'}` was a dead end with no way
  out, and `{prefix: 'target'}` returned `--target-min` and `--target-lg` but never
  `--target` itself. Both spellings now work.

  ## `@elirobinson/tokens/dials` — new export

  The roster as data, for anything that generates:

  ```js
  import { COMBINATIONS, DIALS, PALETTES, tokenDials } from '@elirobinson/tokens/dials';
  ```

  `DIALS`, `PALETTES`, `THEMES`, `PLATFORMS`, `COMBINATIONS`, `dialAttributeString()`
  for the attributes that select a selection, `platformOverrides()` for what a
  platform re-points, and `tokenDials()` for every token's value in every
  combination. There is still exactly one list — `PALETTES` in `./contrast` — and
  this re-exports it.

  If you keep your own palette switcher, theme provider, or token table, this is
  what it should read instead of a list of its own.

  ## Scaffolded apps can reach the dials

  `create-elirobinson-design-system` now writes a `lib/dials.ts` and a pre-paint
  bootstrap in the root layout, so a new app can render any combination instead of
  only `ember/light`. It ships the plumbing and **no switcher UI** — which dials a
  product exposes is a product decision. `lib/dials.ts` says where a switcher
  attaches.

  The bootstrap validates a stored palette against `PALETTES` from the roster, has
  no system fallback for brand (there is no `prefers-*` signal for it, and an
  absent attribute already means the default), and does both reads and both writes
  in a single `try` — split across two, a visitor who chose slate could be painted
  ember-dark on first paint when storage throws. `data-platform` is deliberately
  not written: `mobile.css` already carries a `@media (max-width: 480px) and
(pointer: coarse)` twin, which is the right mechanism for one document served to
  everything.

  ## Contracts

  `tier-boundary` no longer enumerates the tiers — it points at
  `@elirobinson/react/manifest`, whose `tiers` are read off the directory layout,
  and adds the rule for when something belongs in `ai/`. `minimumTouchTarget` now
  names `var(--target)`, `var(--target-min)` and `var(--target-lg)` rather than the
  literal `44x44`, which had been instructing consumers to write a hardcoded pixel
  value that the sibling `no-hardcoded-design-values` contract forbids and that
  `data-platform="mobile"` cannot re-point.

## 0.11.1

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

## 0.11.0

### Minor Changes

- f549d48: Add `miltinson`, a third palette: teal over indigo.

  `data-palette="miltinson"` joins `ember` and `slate` on the palette dial. It is
  the brand miltinsons.com and the other Miltinson properties render in, moved
  onto the dial so those sites stop re-declaring `--accent*` in a local `:root`
  block that no contrast gate can see. Nothing about `ember` or `slate` changes,
  and an app that sets no `data-palette` is unaffected.

  The three teals those properties already ship are pinned to ramp steps rather
  than re-picked, so adopting the palette is a swap and not a redesign:

  | Step           | Value     | Was                       |
  | -------------- | --------- | ------------------------- |
  | `--signal-300` | `#5eead4` | `teal-light`              |
  | `--signal-500` | `#14b8a6` | `teal` — the resting fill |
  | `--signal-600` | `#0d9488` | `teal-dark`               |

  Structurally it follows `ember` rather than `slate`: `--accent` is the 500 step
  carrying `--ink-1000`, hover **lightens** to 400 and press darkens to 600. Teal
  peaks bright enough that the whole triad clears AA against its own fill in both
  themes — 8.44 / 11.10 / 5.61, the same three numbers in light and dark — which
  is what lets one `--accent-fg` serve both blocks. `slate` has to spend two
  different foregrounds on the same problem because its teal is deeper.

  `--anchor` is indigo, held about 90 degrees off the signal so a trust mark
  never reads as a muted CTA, and pulled toward the neutral hue so it sits on the
  greys rather than on top of them. `--anchor-400` is parked in the narrow band
  that clears 4.5:1 against both white and black (4.61 / 4.55), the same trick
  `slate` uses, which lets one step be the hover fill in light and the press fill
  in dark.

  ### The neutral dial is 252, not the properties' own 286

  Worth recording because it was measured rather than chosen. The properties'
  charcoal sits at hue 286, and a palette declaring `--n-h: 286` fails
  `contrast.test.mjs`: `--fg-2` measures 8.4490 under ember, 8.4485 under slate
  and 8.4798 under miltinson, a spread of 0.031 against a `PALETTE_TOLERANCE` of
  0.01. Lightness is untouched, but oklch chroma is not perfectly
  luminance-neutral in sRGB and a 39-degree rotation is far enough to show up in
  the second decimal.

  Lowering `--n-mult` does not rescue it — the spread is hue-dominated and barely
  responds. The passing band is roughly within 8 degrees of ember's 247, so the
  palette takes `--n-h: 252` (slate's hue) at `--n-mult: 1` (ember's chroma), for
  a spread of 0.004. At these chroma levels the difference between hue 252 and
  286 is well under one 8-bit unit per channel; the identity a consumer sees is
  carried by the teal and by the surfaces they pin themselves, not by the hue of
  a near-achromatic grey.

  ### Ratio comments in `palettes.css` are not gated

  Found while writing this: corrupting `--accent-ink`'s trailing `9.65:1` to
  `4.11:1` leaves all 675 token tests green, though `docs/agents/tokens.md` says
  a comment that drifts from its value is a failing build. That guarantee holds
  for the tokens the `CONTRAST_RULES` sweep names and not for the palette blocks'
  per-declaration comments. Every ratio in the new blocks was instead verified by
  re-resolving it through `combinationValues()` and `contrastRatio()`; four
  comments were off by 0.01–0.03 against the repo's own converter and were
  corrected. Closing the gap properly is worth its own change.

## 0.10.0

### Minor Changes

- 0f09b17: Ship the token migrations as a manifest and a command, instead of as prose.

  The palette release changes `--status-success` and `--status-warning`, makes
  `--fg-inverse` wrong on a status fill, requires a warning edge to be
  `--status-warning-border`, and demotes `--fg-on-signal` to a legacy alias. Until
  now the entire migration surface for that was the changelog: `ds-resync` printed
  the entries, and step 4 of its skill told an agent to "fix the call sites the
  breaking entries described". Every consuming repo re-derived the same find and
  replace by hand, from prose, every release — which is precisely the thing this
  repo says it will not ship.

  ## The manifest

  `@elirobinson/tokens` now ships `src/migrations.json`, exported as
  `@elirobinson/tokens/migrations` with its schema in `migrations.d.mts`. Each
  entry names the tokens it applies to, the version it landed in, the replacement
  if there is one, **the context that disambiguates it**, and the human reason:

  ```json
  {
    "id": "warning-needs-an-edge",
    "since": "0.9.0",
    "kind": "rename",
    "from": ["--status-warning"],
    "to": "--status-warning-border",
    "when": { "properties": ["border", "border-color", "outline-color", "…"] },
    "report": "occurrence",
    "reason": "--status-warning is 1.87:1 on --bg in light. …",
    "guidance": "Keep the fill. Move only the edge."
  }
  ```

  The `when` block is the whole point. `--status-warning` as a `background` is
  correct and must be left alone; the same token as a `border-color` has to move.
  An entry with no `when` applies everywhere; `blockMentions` plus
  `blockProperties` express "this text is drawn on a status fill" precisely enough
  to tell it apart from "a status token appears somewhere in this block".

  Four kinds, and only one of them is ever rewritten:

  | `kind`    | What it means                         | What happens          |
  | --------- | ------------------------------------- | --------------------- |
  | `rename`  | replaced by a differently-named token | rewritten, in context |
  | `repoint` | same name, different value            | reported              |
  | `review`  | still valid, wrong in this context    | reported              |
  | `removed` | gone, no replacement                  | reported              |

  ## The command

  ```bash
  pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate
  pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate --write
  ```

  Read-only until `--write`, the same as every other `ds-resync` command. It reads
  the manifest out of your `node_modules` — not out of `ds-resync` — so the
  migrations you get are the ones the version you just installed shipped with. The
  range comes from `.claude/ds-resync.json`, which `ds-resync --write` now leaves
  behind, so in the normal flow the command takes no arguments. `--from` and
  `--to` are there for a repo that upgraded some other way.

  **It refuses more than it rewrites, deliberately.** A token assigned to one of
  your own custom properties, a `borderColor` inside a ternary, a value whose name
  did not change — each is reported with a `why not` and a `use:` line and left
  exactly where it is. `bumpRange` in this same CLI has always returned null for a
  range it could not rewrite safely rather than guessing at your intent; this
  holds the same line over a much larger blast radius. There is no `--force`.

  `--fail-on-pending` exits 2 while anything is still left for a human.

  ## The manifest cannot go stale

  A migration manifest that drifts is worse than none, because the tooling built
  on it will be trusted. So it is not allowed to be the author's memory of what
  they changed. `packages/tokens` commits the previous token roster and
  `migrations.test.mjs` derives what actually moved between it and the stylesheets
  on disk; a token removed or repointed with no entry naming it fails the build,
  by name:

  ```
  1 token repointed with no migration entry:
    --status-success

  A consumer has these in their own CSS and TSX. Add an entry to migrations.json
  naming each one in its `from`, then accept the new roster with:
    node scripts/accept-token-baseline.mjs
  ```

  The other direction is checked too: a `to` naming a token that is not declared
  anywhere would have `--write` writing a dead variable into your stylesheet.

  ## Also in this release

  `@elirobinson/eslint-config` gains
  `@elirobinson-css/no-mismatched-status-foreground`, enabled by
  `designSystemCss()`. A changelog cannot reach your own stylesheets and a codemod
  only runs when you run it; a lint rule catches the same three defects every time
  anyone writes them again — a theme-flipping foreground on a status fill,
  `--status-warning` painting an edge, and `--fg-on-signal` in new code.

## 0.9.0

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

## 0.8.0

### Minor Changes

- 6b67f05: Add the muted foregrounds an inverted band was missing.

  `--bg-inverse` flips with the theme — that is the point of it, and it is what
  keeps a dark hero or footer visible against either page. But the inverse pair
  only ever shipped one foreground, `--fg-inverse`. Anything secondary drawn on
  such a band had nowhere to go except a fixed ramp step, and a fixed step does
  not flip when the surface under it does.

  The docs site is the proof. `.home-hero__lead` and `.site-footer__tagline`
  used `--ink-300`: 13.7:1 in light, and **1.53:1** in dark once the band turned
  white. `.site-footer__meta` on `--ink-400` fell to 2.67:1, and the hero eyebrow
  on `--signal-400` to 2.07:1. The footer renders from the root layout, so that
  was every page on the site, and there was no correct way to write the CSS —
  the tokens for it did not exist.

  Three new tokens, each defined in both themes:
  - `--fg-inverse-2` — secondary text on `--bg-inverse` (13.73:1 light, 8.45:1 dark)
  - `--fg-inverse-3` — tertiary and meta text on `--bg-inverse` (7.87:1 light, 4.85:1 dark)
  - `--accent-ink-inverse` — amber that can be read on `--bg-inverse` (10.17:1 light, 9.69:1 dark), the `--accent-ink` of the inverted surface

  Each is the mirror theme's own foreground, which is what makes them provable
  rather than eyeballed: `--bg-inverse` in one theme is exactly `--bg` in the
  other, so their ratio on the band is a ratio the mirror theme already measures
  against its page.

  They are excepted from the against-`--bg` rule in `contrast.mjs` — `--bg` is
  the wrong background for them — and asserted as pairs against `--bg-inverse`
  in `contrast.test.mjs`, alongside `--fg-inverse`. The gate that would have
  caught this originally now covers the whole inverse family rather than its
  primary foreground alone.

  Nothing changes in light mode: every ratio there is identical to what it was.

## 0.7.3

### Patch Changes

- 64f3f58: Quantise `--gutter` to whole pixels.

  `--gutter` was `max(20px, 4vw)`. At a 1280px viewport that is 51.2px, and the
  fraction does not stay where it starts: it becomes the inline origin of every
  shell padded with it, so the grid track after a 260px sidebar and a 64px gap
  lands on 853.625px rather than 852px, and every full-width rule, table and code
  block inside that column ends up with partially-covered pixels at both ends.

  Partial coverage is where determinism goes. The interior of those elements
  rasterises identically every time; the end caps round inconsistently, so
  pixel-exact snapshots of the docs site failed by one to four pixels on a
  rotating set of pages — never the same set twice, never in the middle of
  anything, always at x = the column's left and right edges. It read like flake
  because the symptom moved. It was arithmetic.

  `round(4vw, 4px)` keeps the gutter responsive and removes the fraction at the
  source: the result is always a whole number of pixels, at any viewport width.
  Below roughly 500px the `max()` still resolves to the flat 20px, so narrow
  layouts are byte-for-byte what they were.

  Consumers see the gutter move by at most 2px at a given width — 51.2px becomes
  52px at 1280. Any layout that was pixel-snapping around the old fractional value
  will settle onto whole pixels instead.

  Note this uses CSS `round()`, which is newer than the `oklch()` this stylesheet
  already depends on throughout. Browsers old enough to lack it would have lost
  the colour system first.

## 0.7.2

### Patch Changes

- 96e25db: Name the reference background in every `--status-*-fg` annotation, and measure
  status text on the neutral surfaces.

  The four `--status-*-fg` tokens were the only meaningful foreground family in
  `tokens.css` whose trailing annotations did not say what they were measured
  against — `/* 11.41:1 */` rather than the `/* 3.64:1 on --bg */` that
  `--border-control` two blocks up already carries — and the dark block carried no
  label at all. The reference was documented six lines up in the section comment,
  which is exactly where a reader scanning declarations does not look. A consuming
  app read `--status-danger-fg: /* 7.55:1 */`, assumed a `--surface-2` row tint had
  taken it under AA, and filed the wrong diagnosis. The tint costs 0.34; the text
  measures 7.21:1.

  All eight annotations now name `--bg`, and the section comment records the worst
  neutral surface once per theme: on `--surface-3` the four sit at
  10.22 / 8.68 / 6.76 / 6.46 in light and 9.54 / 9.55 / 6.80 / 8.25 in dark, at
  most 1.54 below their `--bg` figure. No token value changed — every number was
  already correct, and each reconciles to the hundredth with this package's own
  `contrastRatio`.

  `contrast.test.mjs` now measures all four against `--surface`, `--surface-2`,
  `--surface-3`, `--bg-subtle` and `--bg-muted` in both themes, alongside the `--fg`
  rows that established the pattern. Forty new assertions, all passing today; they
  are what keeps the section comment honest if a surface or a status hue ever moves.

## 0.7.1

### Patch Changes

- 0917a4d: Self-host Geist and JetBrains Mono. `tokens.css` no longer reaches Google Fonts through a render-blocking remote `@import` — it `@import`s a package-local `fonts.css` that declares `@font-face` over woff2 files shipped in the package (both families are SIL OFL 1.1; licenses included). Importing `@elirobinson/tokens/tokens.css` is enough: bundlers inline the import and emit the font assets, a plain `<link>` resolves it relatively, and no request leaves the consumer's origin. Consumers that stripped the remote import and self-hosted via `@fontsource-variable/*` (plus `--ds-font-*-override` pointing at those families) can delete that wiring. The `@elirobinson/ai-patterns` brand skill ships the same faces alongside `colors_and_type.css`, so its `@import './fonts.css'` resolves in a consumer's `.claude/skills/` too.

## 0.7.0

### Minor Changes

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

## 0.6.0

### Minor Changes

- 84aef19: WCAG 2.2 AA conformance across the system, and the tests that keep it.

  `<a class="ds-button ds-button--accent">` rendered amber-on-amber on hover — 2.31:1 in light, 1.00:1 in dark, failing SC 1.4.3. The cause was specificity, not a bad colour: the global `a:hover` is (0,1,1) and beats a (0,1,0) variant class, and the variant's `:hover` only moved `background-color`. Auditing for the same shape turned up 14 more failures, most of them dark-mode only.

  **New tokens.** `--border-control` (3.64:1 / 3.95:1) for control edges, separating them from the now explicitly decorative `--border` and `--border-strong`. `--fg-disabled` (4.85:1 / 7.87:1) for disabled control text, separating it from the decorative `--fg-4`. `--accent-ink` (9.69:1 / 10.17:1) for brand amber a user reads, separating it from the 2.53:1 `--accent` fill. `--status-*-fg` and `--status-*-tint` complete each status set, so a tinted panel's fill and its text always theme together. `--link-on-fill` keeps a link on a filled surface from being repainted by the global `a:hover`.

  **Changed values.** `--link-hover` moves from `--signal-700` to `--signal-800` (5.86:1 to 9.69:1). `--status-success` gains a dark override — forest green was 2.58:1 on a black page.

  **Breaking-ish, in the visual sense.** Component colours change. A filled variant now restates `color` in every state; control edges, disabled text and status text point at the new tokens; and components no longer paint fixed base-scale values (`--ink-*`, `--signal-*`, `--anchor-*`), which is what made a tab underline, a switch track and a tooltip invisible in dark mode. `Rating` draws `★` and `☆` rather than one glyph in two colours — the value was carried by colour alone, which is SC 1.4.1.

  Tailwind consumers get the split through the bridge: `border-control`, `text-foreground-disabled`, `text-accent-ink`, and `bg-*-tint` / `text-*-ink` per status. `border-input` now resolves to `--border-control`.

  **Enforcement.** Three new test layers fail the build rather than documenting the rule: `contrast.mjs`/`contrast.test.mjs` measure every meaningful token against `--bg` in both themes plus the fill/text pairs; `component-css.test.mjs` checks control edges, the restated `color`, and the base-scale ban; `button-contrast.test.mjs` resolves the real cascade over the shipped stylesheets and measures what the label actually renders as. The colour math moved to `@elirobinson/tokens/color` so the gate and the docs cannot disagree.

## 0.5.0

### Minor Changes

- b11ae1b: Give the font families a supported override hook, and write down the cascade
  rule that made overriding a token guesswork.

  Adopting the Tailwind bridge in a `next/font` app silently dropped the brand
  typeface: the page rendered in the system font and nothing errored. Two causes,
  both ours.

  **`@elirobinson/tokens`**
  - `--font-sans`, `--font-display` and `--font-mono` now read a
    `--ds-font-*-override` before their own stack:

    ```css
    :root {
      --ds-font-sans-override: var(--font-geist-sans);
      --ds-font-mono-override: var(--font-geist-mono);
    }
    ```

    `next/font` never exposes a family under its real name — it generates one and
    hands it over in a CSS variable — so the literal `'Geist'` matched nothing the
    app had loaded and `body`, every `.t-*` class and the `font-sans` utility fell
    through to `ui-sans-serif`. Purely additive: an unset override resolves to the
    exact stack that shipped before, so nothing changes for existing consumers.
    Scoped to the three families, because a family is the only token whose value
    the framework legitimately owns at runtime.

  - **`tokens.css` is unlayered, by design, and that is now documented.**
    Unlayered declarations beat anything inside a cascade layer whatever the
    order, so an override written inside `@layer base` — the conventional place in
    a Next.js `globals.css`, and where the docs implied it belonged — silently
    loses. Overrides go in a plain `:root` block. The `--ds-font-*-override` hooks
    are exempt: the stylesheet declares them nowhere, so they apply from any
    layer.
  - `parse-tokens-css` resolves a `var()`'s fallback when the property it names is
    undeclared, the way a browser does, and no longer reads a declaration written
    inside a comment as a token. Without the first, every consumer of the parsed
    token set — `tokens.json`, `ds tokens`, the docs foundations pages, the llms
    snapshot — would have started reporting a raw `var()` for the three families.

  **`@elirobinson/ai-patterns`**
  - `patterns.md` gains a third _Integration note_ alongside the `next-themes`
    selector and the Tailwind bridge — the same species of silent failure —
    including the `<html>` vs `<body>` detail: `--font-geist-sans` has to be
    defined at `:root` for the override to resolve.
  - The `adopt-system` prompt and all four agent instruction templates carry the
    cascade rule and the font hook.
  - `ds tokens` keeps agreeing with the shared parser on comments and on values
    Prettier wrapped across lines.

## 0.4.0

### Minor Changes

- c6cfaa0: Make `tokens.css` the only place the token set is written down.

  **`@elirobinson/tokens`**
  - `tokens.json` is now generated from `tokens.css` at build time. The
    hand-maintained file had drifted to 95 leaf values against 151 `:root` custom
    properties — `--signal-200/300/400/600/800/900` and
    `--anchor-200/300/400/600/800/900` were missing entirely, with nothing marking
    the file as partial. All 151 are now present. The nested shape and every key
    that existed before are unchanged, so `@elirobinson/tokens/tokens-data` and
    `@elirobinson/tokens/tokens.json` keep working; 62 leaves were added.
    Values are now copied verbatim out of the stylesheet, so a few that the
    hand-written file had padded change spelling without changing meaning
    (`oklch(86.0% …)` → `oklch(86% …)`).
  - New export `@elirobinson/tokens/parse-tokens-css` — the one CSS token parser,
    previously duplicated in three places across the monorepo.
  - The package has tests for the first time, including one that fails if
    `tokens.json` stops covering every `:root` custom property.

  **`@elirobinson/ai-patterns`**
  - The `colors_and_type.css` shipped into `.claude/skills/miltinson-design/` is
    now the tokens package's own `tokens.css` rather than a hand-kept sibling of
    it. The two had diverged: the copy consumers received was missing the `.dark`
    compatibility selector and the dark-mode `--focus-ring` override, so every
    `outline: 2px solid var(--focus-ring)` was black-on-black in dark mode — a
    silent failure of the `focusVisibleRequired` contract.
  - `ds tokens` now reads only `:root` and, when a token is declared twice, prints
    the declaration CSS actually applies. `--status-success` and
    `--status-warning` are re-pointed at brand colors after the base scale
    declares them, so they previously printed the shadowed value.

## 0.3.0

### Minor Changes

- 8c7d56b: Ship `@elirobinson/tokens/tailwind.css`, a Tailwind v4 bridge, and fix dark-mode focus and
  theming compatibility.
  - **`tailwind.css`** aliases Tailwind's theme namespaces onto the semantic tokens, so
    `bg-background`, `text-muted-foreground`, `border-border`, `ring-ring`, `rounded-md`,
    `shadow-md`, `font-sans` and `ease-out` resolve to design system values instead of
    Tailwind's defaults — or, as consumers hit in practice, to nothing at all. Covers
    background, foreground, card, popover, primary, secondary, muted, accent, destructive,
    success, warning, info, border, input, ring, surface and anchor, plus `--radius` for the
    shadcn/ui components that read it directly. Consumers write one `@import` instead of
    maintaining ~30 aliases, and the shadcn `--accent: var(--accent)` circularity trap is
    handled rather than left to be rediscovered. Everything is `@theme inline`, so utilities
    keep responding to `[data-theme="dark"]` at runtime.
  - **`.dark` compatibility selector** alongside `[data-theme="dark"]`. Class-strategy theme
    switchers — `next-themes` defaults to one — previously toggled a class the stylesheet
    never looked at, so dark mode silently did nothing. `[data-theme="dark"]` remains the
    documented convention.
  - **`--focus-ring` now inverts in dark mode.** It was ink-on-white in both themes, which
    made every `outline: 2px solid var(--focus-ring)` in the component library invisible
    against a black page — a silent failure of the `focusVisibleRequired` contract.

  Additive: `tokens.css`, `tokens.json` and `tokens-data` are unchanged apart from the two
  dark-mode fixes above.

### Patch Changes

- a82dcc9: Add `ds-resync`, a command for bringing a consuming repo's `@elirobinson/*` packages up to
  date. A bare run reports current versus latest per package along with the changelog entries
  in between; `--write` rewrites the ranges and installs.

  `@elirobinson/react` and `@elirobinson/tokens` now ship `CHANGELOG.md` in their published
  tarballs, which is what makes the migration notes readable from a consuming repo.

## 0.2.0

### Minor Changes

- 52b1b6d: Remove root barrel exports. Import token data from `@elirobinson/tokens/tokens-data` and AI patterns from `@elirobinson/ai-patterns/patterns` or `./contracts`.

## 0.1.2

### Patch Changes

- 5fcffbf: Add overlay primitives (DropdownMenu, Popover, Tooltip, Sheet, Toast), marketing typography (Eyebrow, RuleLink), expanded tokens.json, Storybook coverage, and unit tests for interactive components.

## 0.1.1

### Patch Changes

- 60e0c53: Publish design system packages to the GitHub Packages npm registry.
