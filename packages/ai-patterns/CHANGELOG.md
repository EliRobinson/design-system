# @elirobinson/ai-patterns

## 0.18.0

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

## 0.17.0

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

## 0.16.0

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

## 0.15.2

### Patch Changes

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

## 0.15.1

### Patch Changes

- d9391af: Visual regression: the `docs-wide` Playwright project is temporarily disabled.

  This is repo CI, not published behaviour — no consumer API changes. A consuming
  repo using `@elirobinson/ai-patterns/testing/visual-config` is unaffected: the
  preset still exports `WIDE_VIEWPORT` and `NARROW_VIEWPORT`, and which projects
  you run has always been yours to declare in your own `playwright.config.ts`.

  If you mirror this repo's project list, note the reasoning: the docs sidebar
  renders on every page and derives from one registry, so adding a single
  component invalidates every wide-viewport page shot at once — 142 of them on
  PR #88, against zero story failures. A per-page suite whose failures are all
  the same one bit is noise on exactly the pull requests it should be protecting.
  Component-isolating story shots carry the real signal.

## 0.15.0

### Minor Changes

- 72eb10e: Ship the control-edge contrast rule instead of describing it.

  `--border` (1.24:1 against `--bg`) and `--border-strong` (1.53:1) are
  decorative on purpose — card seams, table rules, dividers, the edge of a
  floating panel. `--border-control` (3.64:1 light, 3.95:1 dark) is the edge that
  tells a user where an input, switch, chip, slider, stepper or segmented control
  is, which SC 1.4.11 asks to clear 3:1. Both tokens measure correctly on their
  own, so a per-token contrast sweep cannot see the mistake: it is a stylesheet
  reaching for the wrong one. Inside this repo `component-css.test.mjs` has swept
  for it for a while. A consuming app's own stylesheets had nothing but prose.

  **What a consumer must do**
  1. If you already use the CSS entry point, the rule turns on by itself — it is
     added to the config `designSystemCss()` returns, at whatever `severity` you
     already pass. Just run your lint:

     ```bash
     pnpm eslint .
     ```

     Every new `@elirobinson-css/no-decorative-control-edge` error names the
     selector, the declaration and the token it found.

  2. If you are not linting CSS yet, add the entry point (it needs `@eslint/css`,
     which is why it is separate):

     ```js
     // eslint.config.mjs
     import designSystem from '@elirobinson/eslint-config';
     import designSystemCss from '@elirobinson/eslint-config/css';

     export default [...designSystem(), ...designSystemCss()];
     ```

     Point it away from any stylesheet that _defines_ values rather than consuming
     them — your own token layer, vendored CSS — with
     `designSystemCss({ ignores: ['src/styles/tokens.css'] })`.

  3. Fix each hit by swapping the token on that declaration. The find/replace is
     mechanical once you have the list:

     ```
     border: 1px solid var(--border)         →  border: 1px solid var(--border-control)
     border-color: var(--border-strong)      →  border-color: var(--border-control)
     ```

     Tailwind users: `border-border` → `border-control` on a control. `border-input`
     already resolves to `--border-control`, so an input using it needs no change.

  4. If a flagged selector is genuinely decorative — a floating panel a widget
     opens, an outline badge, a rule under a tab strip — keep the decorative token
     and silence that one line, rather than widening the ignore list:

     ```css
     /* eslint-disable-next-line @elirobinson-css/no-decorative-control-edge */
     border: 1px solid var(--border);
     ```

     The test to apply: if the border were invisible, would the user lose the
     control? Then it is `--border-control`.

  **Scope, so you know what will and will not fire**

  The rule matches a selector that reads as a control on whole words — `btn`,
  `button`, `cta`, `chip`, `action`, `pagination`, `segmented`, `input`, `field`,
  `select`, `textarea`, `switch`, `toggle`, `checkbox`, `radio`, `slider`,
  `stepper`, `search`, `kbd`, `trigger` — plus the `button`/`input`/`select`/
  `textarea` elements and the matching `type=`/`role=` attributes. It is
  deliberately narrower than `no-underlined-control-label`: a badge or a tab strip
  paints a fill, so an underline inside it is a defect, but its border is trim.
  Only colour-bearing border properties are checked, so `border-radius` and
  `border-width` are never flagged, and only `var(--border)` / `var(--border-strong)`
  are — a hardcoded `#ddd` is `no-hardcoded-design-values`' job.

  **Also in this release**

  `@elirobinson/ai-patterns/contracts` gains a `control-edge-contrast` entry under
  `componentConstraints`, so an agent working in your repo gets the constraint,
  its check and what verifies it without reading anyone's docs.

## 0.14.0

### Minor Changes

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

- 64f3f58: Ship the visual regression suite as a preset instead of something to copy.
  - New `@elirobinson/ai-patterns/testing/visual-config`: `defineVisualConfig` returns the
    determinism contract a screenshot suite has to hold — pinned clock, locale and timezone,
    `animations: 'disabled'`, exact pixel comparison (`threshold: 0`, and both diff budgets at
    zero), no retries, and `updateSnapshots: 'none'` so Playwright's default never quietly
    writes a baseline nobody asked for. `assertContainedBaselineUpdate` refuses
    `--update-snapshots` outside the pinned container, which is what stops a laptop's font
    rendering from becoming the baseline everyone else fails against. `use` and `expect` merge
    two levels deep, so setting one option there cannot silently drop the contract beneath it.
  - New `@elirobinson/ai-patterns/testing/visual-sweep`: `sweepStorybook` and `sweepPages`
    register one test per subject per theme — theming, settling, caret suppression and the
    capture itself included — and `storybookStories` / `nextStaticRoutes` enumerate those
    subjects from a build's own `index.json` and prerender manifest. There is no list of
    components to snapshot anywhere, in this repo or a consumer's: adding a story or a page is
    all it takes to get a baseline.
  - Both are plain `.mjs` with hand-written types, resolvable from CommonJS, and take
    Playwright's `test` and `expect` as arguments rather than importing them, so
    `@playwright/test` stays an optional peer.

## 0.13.0

### Minor Changes

- 5a36a91: A control no longer gets to dress up as a link. `@elirobinson/eslint-config/css` gains
  `no-underlined-control-label`: a rule that paints a control's own filled surface and also
  declares `text-decoration: underline` is an error, because an underline is the one visual
  signal a hyperlink owns and a reader cannot tell a button wearing it from a link. A
  link-styled button on no fill, and a link that happens to sit on a fill, are both
  deliberate patterns and stay silent.

  The matching `componentConstraints` entry ships in `@elirobinson/ai-patterns`' contracts,
  with its `verifiedBy` naming the lint rule and the two `@elirobinson/react` tests that pin
  the same property inside the system.

  No token values changed, and no component changed: `.ds-button` already dropped the
  underline in every variant. This is the guard that keeps it that way.

### Patch Changes

- 056ba51: Derive the brand skill's file inventory from what the tarball actually contains.

  The consumer copies of `README.md` and `SKILL.md` listed the skill's files from
  `BRAND_INDEX`, a hand-kept array in `src/artifacts/brand.mjs`. It named the four
  `ui_kits/<kit>/` folders and missed `ui_kits/_shared/`, so every consumer
  received `Primitives.jsx` — the file all four kits load over
  `../_shared/Primitives.jsx` — with no document mentioning it, and a kit copied
  out on the strength of the inventory rendered nothing.

  The rows now come from the files the packer stages, at full depth.
  `BRAND_DESCRIPTIONS` holds only the editorial one-liner per row, and the build
  fails on a shipped folder with no row **and** on a row with no files behind it.
  The check it replaces compared first path segments only, which is why `ui_kits`
  being described four times over was enough to hide a fifth folder from it.

## 0.12.2

### Patch Changes

- ef18f53: Drop the stray chat screenshot from the shipped brand manifest. `uploads/pasted-1777227214382-0.png` was pasted working material, not brand material, but the `@elirobinson/ai-patterns/brand-manifest` export (`dist/artifacts/brand-manifest.json`, published in `dist`) carried an entry for it under `category: "scratch"`. That entry is gone; a `.gitkeep` entry (same `category: "scratch"`, `origin: "incidental"`, `ships: false`) takes its place so the directory stays present for the manifest generator without tracking pasted files.

## 0.12.1

### Patch Changes

- 0917a4d: Self-host Geist and JetBrains Mono. `tokens.css` no longer reaches Google Fonts through a render-blocking remote `@import` — it `@import`s a package-local `fonts.css` that declares `@font-face` over woff2 files shipped in the package (both families are SIL OFL 1.1; licenses included). Importing `@elirobinson/tokens/tokens.css` is enough: bundlers inline the import and emit the font assets, a plain `<link>` resolves it relatively, and no request leaves the consumer's origin. Consumers that stripped the remote import and self-hosted via `@fontsource-variable/*` (plus `--ds-font-*-override` pointing at those families) can delete that wiring. The `@elirobinson/ai-patterns` brand skill ships the same faces alongside `colors_and_type.css`, so its `@import './fonts.css'` resolves in a consumer's `.claude/skills/` too.

## 0.12.0

### Minor Changes

- 32f76d2: Add the **UI Copy Is Chrome** rule, and ship a lint rule for the literal half of it.

  Functional copy — errors, empty states, helper and hint text, toasts, labels,
  button text, tooltips, confirmations, validation — is chrome. It states the fact,
  then the consequence, then the action, and stops. The rule names the six ways
  that gets padded into marketing: unverifiable frequency claims ("almost always"),
  blame attribution ("on their side", "check your connection"), filler pacing ("in
  a moment", "hang tight"), unprompted reassurance or apology ("don't worry",
  "we'll sort it out"), escalation paths nobody asked for, and enthusiasm ("Great
  news!", exclamation marks). Reassurance is allowed only where it answers a
  question the reader is actually asking, and only as a fact: "You have not been
  charged." Past two short sentences, functional copy is explaining, reassuring, or
  selling.

  **The rule governs chrome, never a product's editorial voice**, and that
  distinction is repeated everywhere the rule appears rather than stated once.
  Marketing prose, conversational surfaces, and written deliverables are content;
  their voice is a deliberate design decision and this says nothing about them.
  Read as an instruction to write plainly everywhere, the rule does more harm than
  the padding it removes — which is why it is worth writing down instead of leaving
  to taste.

  Where it now lives, so a consumer picks it up by upgrading:
  - **`pnpm ds patterns`** — as principle 6, and as a line in the **Definition of
    Done for UI work**, which is the checklist agents are told to work before
    calling UI done.
  - **`pnpm ds contracts`** — a new `ui-copy` constraint with its own `check` and
    `verifiedBy`.
  - **All four agent templates** written by `ds init --agents` (`AGENTS.md`'s
    managed block, the Claude Code skill, the Cursor rule, the Copilot
    instructions), so the next `init` carries it into every consuming repo.
  - **`pnpm ds prompts audit-page`** — a seventh check, with editorial content
    explicitly out of scope and wording changes moved to report-don't-fix.

  **New ESLint rule: `@elirobinson/no-padded-ui-copy`**, matching those phrases
  literally. Its scope is the content/chrome line encoded in code rather than left
  to a heuristic: it reads copy props (`title`, `description`, `label`,
  `placeholder`, `helperText`, `error`, `tooltip`, `aria-label`, …) and the
  children of chrome components (`Alert`, `Toast`, `Tooltip`, `Callout`, `Banner`,
  `EmptyState`, `FormMessage`, …). It never reads arbitrary JSX text, so a landing
  page's prose is untouched by construction. The cost is that chrome in an
  unrecognised component is missed, which is the right way round — a rule that
  flagged a product's voice would be switched off within a day.

  **It ships as a warning, not an error.** Every repo upgrading into this has copy
  written before the rule existed, and a hard error on upgrade would block them.
  Raise it once that copy is clean:

  ```js
  export default [...designSystem({ copy: { severity: 'error' } })];
  ```

  `components`, `props` and `allow` options extend or exempt; `severity: 'off'`
  switches it off. The two-sentence limit and the content/chrome judgement stay
  review, not lint — a length check would fire on legitimately long confirmations
  and teach people to disable the rule.

  This repo holds itself to it at `error` across `packages/react` and the docs app,
  which report zero findings today.

## 0.11.0

### Minor Changes

- 242fbe0: The llms corpus gains a brand layer: `llmsFull` accepts an optional `brand` input and renders the voice rules from the brand README (extracted loudly — a missing CONTENT FUNDAMENTALS section throws) plus the kit and asset inventory. The packed snapshot carries only `ships: true` artifacts; a corpus that includes repo-only artifacts gets them marked as such. An agent asked to build a Miltinson page previously got prop tables and tokens and no voice guidance at all.
- 242fbe0: Add `@elirobinson/ai-patterns/brand-manifest`: one record per artifact in `design-system-docs/`, with category, origin (generated cards are identified by importing `buildGuidelineCards`, never a hardcoded list), ships/shipReason derived from `BRAND_SOURCES`, per-artifact render facts (dependencies as written, external origins through the stylesheet chain, viewports), and member roles. The in-repo `design-system-docs/README.md` index table is now generated from it between the managed markers — fixing the phantom `templates/` row, the fifth slide template that never existed, and the auth surface the webapp kit does not export, and adding the six top-level entries the hand-kept table omitted.
- 242fbe0: Two additive surfaces for the MCP server: `@elirobinson/ai-patterns` exports `./adherence` (the generated adherence-config builder) and `./brand-readme` (the packed brand README the voice rules are extracted from), and `@elirobinson/eslint-config` exports `mcpStdio(files)` — a flat-config block for packages that serve MCP over stdio, where a single `console.log` corrupts the JSON-RPC channel: `no-console` at error severity, `console.error` only.

## 0.10.0

### Minor Changes

- 43e1b92: Measure `ds-resync` staleness against the lockfile, and report an out-of-sync `node_modules` as its own finding.

  `ds-resync` decided whether a repo was current by comparing `node_modules`
  against the registry. It never read the lockfile. When an install had drifted
  ahead of the committed manifests, the tool reported the repo as nearly current
  while the state CI and a fresh clone actually build was many versions behind —
  silently, with no indication that the two sources disagreed.

  Observed in a consuming repo: `package.json` asked for `@elirobinson/react`
  `^1.3.0`, the lockfile held 1.3.0, and `node_modules` held 2.0.1. `ds-resync`
  printed "1 package behind: @elirobinson/ai-patterns 0.9.0 → 0.9.2 (patch)". The
  truth was four packages behind, including a major on `react`.

  **What the tool compares now.** The version the lockfile resolved — what CI and
  a fresh clone install — against the registry. `pnpm-lock.yaml`,
  `package-lock.json` and `yarn.lock` are all read, so this is not pnpm-only. With
  no lockfile entry the declared range's floor stands in, and the report says so
  rather than passing it off as a resolved version.

  **A new finding, reported first.** When `node_modules` disagrees with the
  lockfile, the report opens with `NODE_MODULES OUT OF SYNC`, naming both versions
  per package. It is deliberately not the same condition as "behind": the fix is
  an install, not an upgrade. It shows in the default read-only run, and
  `--fail-on-out-of-sync` exits 2 on it in CI. That flag is independent of
  `--fail-on-outdated` — neither trips the other — and is named apart from
  `ds-resync artifacts --fail-on-drift`, which is about the generated snapshot.

  **`elirobinson-ds` now warns too.** Discovery still reads `node_modules`; that
  design is correct and unchanged. But while an install has drifted, `ds` and
  `ds props <Name>` describe an API that is installed here and is not what CI
  builds — the exact path by which an agent writes code that passes locally and
  fails on merge. It now prints a one-line caution to **stderr** when installed
  and locked disagree. stdout is untouched, so anything parsing that output is
  unaffected, and the exit code does not change.

  **What changes for a consumer parsing `--json`.** The per-package baseline is
  now `currentVersion`, with `currentSource` recording whether it came from the
  `lockfile`, a declared `range`, or was `unresolved`. `installedVersion` still
  exists but now means only what is in `node_modules` — it is no longer the
  comparison baseline, and it can be `null`. `lockedVersion` is new, as is a
  top-level `drift` array. Anything reading `installedVersion` as "the version
  this repo is on" should read `currentVersion` instead.

  Also fixes a latent crash: a `workspace:*` dependency resolves to `link:…` in
  the lockfile and its range holds no version, which threw `Unparseable version`
  and produced no output at all. Those packages are now reported as not compared.

## 0.9.2

### Patch Changes

- 4da857a: Fix every documented `dlx` invocation of this package's binaries.

  This package ships two bins, `ds-resync` and `elirobinson-ds`. `pnpm dlx <pkg> <bin>`
  only resolves for a single-bin package — the trailing word is parsed as an argument to
  the implied binary, not as a selector — so every documented entry point aborted with
  `ERR_PNPM_DLX_MULTIPLE_BINS` before our code was spawned. The working form names the
  package explicitly:

  ```bash
  pnpm --package=@elirobinson/ai-patterns dlx ds-resync artifacts --write
  ```

  `RESYNC_COMMAND` held the broken string and is interpolated into the llms corpus and into
  the generated `SKILL.md`, so `ds-resync artifacts --write` wrote a command that cannot run
  into every consuming repo's `.claude/skills/`, and the design-system-reference corpus told
  agents to run it. Re-run `ds-resync artifacts --write` after upgrading to pick up the
  corrected text.

  **Why this is a patch and not a minor.** `RESYNC_COMMAND`'s value changes and a new `DLX`
  constant is exported, which would normally read as a minor. But the old value names a
  command that cannot execute: any consumer depending on it was already broken, there is no
  working behaviour to preserve, and there is nothing to migrate. The change only removes a
  failure.

  Also in this release:
  - New export `DLX` from `@elirobinson/ai-patterns/corpus` — the invocation prefix, as one
    constant. `RESYNC_COMMAND` derives from it, and the stale-snapshot warning imports it
    rather than hardcoding a copy.
  - `src/artifacts/dlx.test.mjs` executes the documented command for both bins in a scratch
    directory and asserts a zero exit — the check that would have caught this, which an
    assertion on the string alone would not — and fails the build if the bare form reappears
    in any tracked file outside the changelogs and the dated plans under `docs/superpowers/`.
    That guard is what protects the Markdown surfaces, which cannot import a constant.

## 0.9.1

### Patch Changes

- 7cd6a82: Generate the Claude Design project's API contract, foundation cards and skill docs.

  The design project carried hand-maintained restatements of this repo — an oxlint
  config describing the component API, and swatch cards enumerating the token
  scale — and both had drifted. The config described a flat prop surface where
  `@elirobinson/react` is compound (it put `Sheet`'s `side` on `Sheet` rather than
  `SheetContent`, exported a `ToastViewport` that does not exist, and invented
  seven child components), and the ink card rendered 10 of the 13 `--ink-*` steps.

  Three generators now derive those artifacts from sources that cannot drift —
  `@elirobinson/react/manifest` and `tokens.css` — reached through a new
  `build:design-project` script. They are internal to this repo: none is added to
  the package's `exports`, so nothing new is importable by a consumer.

  **What changes for a consumer.** The `miltinson-design` skill written by
  `ds-resync artifacts` has one paragraph in a different place. The sentence
  naming the tokens stylesheet and the readme is now inside the managed block
  rather than below it, because the three surfaces that carry this skill spell
  those files differently and the paragraph has to be generated per surface
  instead of shared verbatim. The wording and the brand rules are unchanged; only
  the block boundary moved. Re-run `ds-resync artifacts` to pick it up — the hash
  check will report `SKILL.md` as changed.

## 0.9.0

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

## 0.8.0

### Minor Changes

- 4fb7251: Resolve `@elirobinson/ai-patterns/corpus` from CommonJS, and declare the Node
  floor that makes it work.

  `./corpus` exported only an `import` condition — the same latent bug
  `./testing/playwright` had, found while fixing that one and left out of scope
  there. The caller that renders its own `llms.txt` from its own manifest is a
  build script, and a build script in a `"type": "commonjs"` repo is a plain `.js`
  file, so it reaches this subpath through `require` and died on
  `ERR_PACKAGE_PATH_NOT_EXPORTED` at resolution, before `llmsIndex` was ever
  called. The only working form was `.mjs`, which nothing said — and a subpath a
  consumer has to be told how to import is prose we made them write.

  The `require` condition points at the same `llms.mjs` the `import` condition
  does, rather than at a new CJS build. The module imports nothing at all and
  holds no state — every export is a pure function of its arguments — so pointing
  both conditions at one file also rules out a dual-package split, and
  `packages/ai-patterns` keeps shipping plain files. That leans on Node's
  `require(esm)`, which needs the module to be free of top-level await (it is,
  across an empty dependency graph) and a runtime of 22.12 or newer — hence the
  new `"engines": { "node": ">=22.12.0" }`, which the package previously left
  implied.

  `llms.exports.test.mjs` pins both halves: it resolves the subpath under the
  `require` condition through Node's real export-map resolution, and it actually
  `require()`s the module, so either deleting the condition or introducing a
  top-level await fails here rather than in a consumer's build.

## 0.7.0

### Minor Changes

- 36097a8: Resolve `@elirobinson/ai-patterns/testing/playwright` from CommonJS, and declare
  the Node floor that makes it work.

  `./testing/playwright` exported only an `import` condition. Playwright compiles a
  plain `.ts` spec to CommonJS, so the spec the README documents resolved through
  `require` and died on `ERR_PACKAGE_PATH_NOT_EXPORTED` before a single assertion
  ran. The only working form was a `.spec.mts` file, which nothing said.

  The `require` condition points at the same `playwright.mjs` the `import`
  condition does, rather than at a new CJS build. Nothing in the module needs
  transpiling, it holds no state — every export is a pure function over a `page` —
  so pointing both conditions at one file also rules out a dual-package split, and
  `packages/ai-patterns` keeps shipping plain files. That leans on Node's
  `require(esm)`, which needs the module to be free of top-level await (it is: the
  one `await import('axe-core')` is inside `checkContrast`) and a runtime of 22.12
  or newer — hence the new `"engines": { "node": ">=22.12.0" }`, which the package
  previously left implied.

  `playwright.exports.test.mjs` pins both halves: it resolves the subpath under the
  `require` condition through Node's real export-map resolution, and it actually
  `require()`s the module, so either deleting the condition or adding a top-level
  await fails here rather than in a consumer's E2E suite.

  The README example keeps its `.ts` filename — now accurate — and gains one line
  naming the Node floor and the `.spec.mts` fallback below it.

## 0.6.0

### Minor Changes

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

### Patch Changes

- cc6dd9d: Add a drift test for the published `testing/playwright` type surface.

  `src/testing/playwright.mjs` is plain JavaScript typed by a hand-written
  `playwright.d.ts`, and `./testing/playwright` publishes both as `types` and
  `import`. Nothing checked that the two agreed, so a rename or a new helper could
  leave the declarations describing a module that no longer exists — invisible in
  this repo, and surfacing only when a consumer's test suite compiles against the
  lie.

  `playwright.types.test.mjs` compares the module's real runtime exports against
  the value declarations parsed out of the `.d.ts` in both directions, and names
  the specific export that drifted in the failure message. No new dependencies.

  Also updates the `no-barrel-imports` check text in `contracts.json`, which
  enumerates the legal `@elirobinson/*` subpaths, to say `styles/*.css` rather
  than `styles/*` — `@elirobinson/react` v2 narrows that export, and the shipped
  contract must not advertise a pattern that no longer resolves.

- 98839c4: Internal: `ds-resync` parses both commands' flags through one table-driven parser instead of two hand-rolled else-if chains, so a flag both commands should honour can no longer land on only one. No change to flag names, defaults, or error messages.
- c476af3: Internal: `ds-resync` generates both commands' `Options:` help from the same flag table it parses with, and the argument handling moved out of `cli.mjs` into a sibling `args.mjs`. Adding a flag is now one edit rather than a table entry plus a matching usage block. The rendered help text is byte-identical, pinned by a test.
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

## 0.5.0

### Minor Changes

- 68d5273: **Fixes `ds-resync` never running when installed.** Since it shipped in 0.4.0, the CLI
  detected whether it was the entry point by checking that `process.argv[1]` ended in
  `cli.mjs`. npm installs a bin as a symlink, so Node reports `.bin/ds-resync` there and the
  check never matched — the command exited 0 having done nothing, on every install. If you
  ran `ds-resync` against 0.4.0 and it appeared to succeed, it did not run; re-run it on this
  version. Entry-point detection now resolves the real path, and a test spawns the CLI
  through a symlink so this cannot regress.

  `ds-resync artifacts` syncs the design system's agent guidance into a consuming repo.
  Three skills land under `.claude/skills/`: the Miltinson brand skill, a version-stamped
  component reference (`llms.txt` / `llms-full.txt` covering every component, prop table,
  token, and machine-checkable constraint), and the `ds-resync` instructions themselves.
  Read-only by default; `--write` applies.

  The package now has a real build/`prepack` step that stages all of it into the tarball,
  so none of this depends on a docs site that is not deployed anywhere. The `/llms-full.txt`
  URLs in `resync/skill`, `prompts/audit-page`, and `prompts/add-component` — which never
  resolved — now point at what actually ships.

  Re-running is safe by construction. Every file written is recorded with its sha256 in
  `.claude/ds-artifacts.json`; a file that still matches is updated, and a file you have
  edited is left exactly as you left it and named in the report. `--force` takes the shipped
  copy instead.

  Each artifact carries the `@elirobinson/react` version it was generated against, and the
  command warns loudly when that is not the version the repo has installed — a snapshot that
  silently describes a different release is how an agent ends up with confidently wrong prop
  tables. `--fail-on-drift` turns that into exit 2 for CI.

## 0.4.0

### Minor Changes

- 8c7d56b: Make the contracts executable and ship the agent-instruction surfaces.
  - New `@elirobinson/ai-patterns/testing/playwright`: `checkTouchTargets`,
    `checkHitAreaOverlap`, `checkFocusVisible`, `checkContrast` and
    `expectDesignSystemContracts` for the `uiContracts` only a browser can settle. Touch
    targets are measured as the _effective_ hit area, so a small glyph expanded with padding
    or a bounded overlay passes. `@playwright/test` and `axe-core` are optional peers.
  - New `@elirobinson/ai-patterns/agents/*`: a Claude Code skill, a Cursor rule, Copilot
    instructions, and an `AGENTS.md` block, installed by `ds init --agents`. None of them
    contains an inventory — they point at `ds`. The `AGENTS.md` fragment merges between
    markers so a consumer's own content survives a re-run.
  - `contracts.json` gains a `verifiedBy` for every entry, naming the lint rule or test
    helper that enforces it — or saying plainly that it is review-only. Two constraints the
    system always implied are now stated: `no-foreign-component-libraries` and
    `no-hardcoded-design-values`. Existing keys keep their existing types;
    `uiContracts.verifiedBy` is a sibling map, so `uiContracts.minimumTouchTarget` is still
    the string `"44x44"`.
  - `patterns.md` gains **Discover, Don't Document** and **Definition of Done for UI work**,
    plus integration notes for the two traps that fail silently: `next-themes` defaulting to
    a `class` strategy the stylesheet never looks at, and Tailwind utilities resolving to
    nothing without the token bridge.
  - The `adopt-system` prompt now starts by wiring up the tooling — CLI, ESLint config,
    Tailwind bridge, agent files, contract tests — before migrating any screen.

- 8c7d56b: Ship the `elirobinson-ds` discovery CLI as a `bin`, so agents and humans ask the installed
  packages what exists instead of trusting a doc.

  Consumers reduce to one package.json line — `"ds": "elirobinson-ds"` — and get `ds`,
  `ds props <Name>`, `ds tokens [filter]`, `ds classes [filter]`, `ds contracts`,
  `ds patterns`, `ds prompts [name]` and `ds init --agents`. Discovery walks the installed
  package tree rather than assuming a directory structure, so the same command describes a
  flat 0.x layout and a tiered 1.x one; it reads `@elirobinson/react`'s new `manifest.json`
  and falls back to parsing emitted declarations on older installs. A missing package
  produces an instruction naming what to install.

  It works from an install (`pnpm ds`, `pnpm exec elirobinson-ds`) or straight from the
  registry (`pnpm dlx @elirobinson/ai-patterns elirobinson-ds`). In the `dlx` case the binary
  is absent from the project's own `node_modules`, so it falls back to its own package root
  for contracts, patterns and prompts rather than reporting itself as not installed.

- a82dcc9: Add `ds-resync`, a command for bringing a consuming repo's `@elirobinson/*` packages up to
  date. A bare run reports current versus latest per package along with the changelog entries
  in between; `--write` rewrites the ranges and installs.

  `@elirobinson/react` and `@elirobinson/tokens` now ship `CHANGELOG.md` in their published
  tarballs, which is what makes the migration notes readable from a consuming repo.

- a6f2796: `ds-resync` can now upgrade a subset of packages, each to a chosen distance. `--only`
  restricts the run to named packages, `--target` picks how far to jump (`latest`, `minor`,
  or `patch`, globally or per package), and `-i` walks the choices interactively.

  This exists for the case that actually blocks an upgrade: a breaking major you are not
  ready for should not cost you the fixes below it. The report names any version held back
  so the deferred migration stays visible.

## 0.3.0

### Minor Changes

- 96092e7: Add prompt templates and extend the machine-checkable contracts.

  Three prompt templates ship under `./prompts/*` (new export): adding a
  component to the system, adopting the system in an existing app, and
  auditing a page for token/accessibility compliance. Each follows the
  existing `patterns.md` house style — intent, constraints, verification
  checklist — and is rendered on the new documentation site's "Build with
  AI" page.

  `contracts.json` gains a `componentConstraints` block so the constraints
  that previously lived only in prose (`docs/agents/components.md`) are
  machine-checkable: the scoped touch-target policy, the `forwardRef`
  requirement, the tier boundary rule, and the no-barrel-imports import
  convention. All existing keys (`systemPromptStyle`, `uiContracts`) are
  unchanged.

## 0.2.0

### Minor Changes

- 52b1b6d: Remove root barrel exports. Import token data from `@elirobinson/tokens/tokens-data` and AI patterns from `@elirobinson/ai-patterns/patterns` or `./contracts`.

## 0.1.1

### Patch Changes

- 60e0c53: Publish design system packages to the GitHub Packages npm registry.
