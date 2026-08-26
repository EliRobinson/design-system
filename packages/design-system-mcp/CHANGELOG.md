# @elirobinson/design-system-mcp

## 0.3.0

### Minor Changes

- fda2027: The brand voice is Miltinson Technologies, and the royal-we rule is retired.

  `Never the royal "we."` was a hard rule in the brand README, and it travelled a long way:
  `brandVoice()` extracts the CONTENT FUNDAMENTALS section into `/llms-full.txt`, the packed skill
  artifact carries it, and the MCP server serves it from `miltinson://brand/voice` and
  `get_brand_guidance`. Every agent building against this system was told the copy must be first
  person singular.

  That is no longer the rule. The voice is Miltinson Technologies, and whether a product writes "I"
  or "we" is that product's decision, taken from what the product is — one name covers a single
  person's site and a company product, and both are the brand. "Eli speaks as himself" is now one
  legitimate instantiation rather than the rule itself. What replaces the prohibition is a
  consistency requirement: pick the person per product and hold it, because the tell of a voice
  nobody decided is one that switches partway down a page.

  Consumers pinned to the old wording will see it change in the corpus, the skill artifact, and the
  MCP resource. Nothing about the API moves.

  Refs #130.

## 0.2.0

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

## 0.1.1

### Patch Changes

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

## 0.1.0

### Minor Changes

- 242fbe0: First release: an MCP server over the installed design-system packages, on `@modelcontextprotocol/server` v2 (`serveStdio` factory wiring). Five tools — `get_component` (props, sub-components, and constraints in one call), `search_tokens`, `get_constraints`, `get_brand_guidance`, `check_adherence` — plus the brand voice and contract set mirrored as resources. Everything reads the consumer's `node_modules` and never the network, so it cannot go stale; every failure message enumerates the valid alternatives so an agent can retry.
