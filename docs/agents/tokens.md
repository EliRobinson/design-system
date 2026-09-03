# Tokens

## Token-first rule

- Import `@elirobinson/tokens/tokens.css` in every app shell.
- Import JSON token data from `@elirobinson/tokens/tokens-data` or `@elirobinson/tokens/tokens.json` — not a package root barrel.
- Never hardcode spacing, radii, colors, or durations — use CSS custom properties from tokens.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`, etc.) in components, not raw scale values (`--ink-500`).

## Three dials

`tokens.css` is one of three stylesheets, and they compose as three independent attributes on the root element. Importing `tokens.css` is still the only thing a consumer does — it `@import`s the other two.

| Dial     | Attribute                           | Owns                                                                                                        | Lives in                      |
| -------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Palette  | `data-palette` (roster: `ds dials`) | the neutral hue and chroma, `--signal-*`, `--anchor-*`, `--accent*`, `--anchor*`, `--link*`, `--focus-ring` | `palettes.css`                |
| Theme    | `data-theme="light\|dark"`          | surfaces, and the re-picked values of everything above                                                      | `palettes.css` + `tokens.css` |
| Platform | `data-platform="mobile"`            | radii, the small end of the type ramp, `--gutter`, control min-height                                       | `mobile.css`                  |

The dials also ship **as data**, at `@elirobinson/tokens/dials` — `DIALS`, `PALETTES`, `THEMES`, `PLATFORMS`, `COMBINATIONS`, and `tokenDials()` for a token's value in each combination. The table above is orientation for a contributor; anything that _generates_ (the `ds` CLI, the MCP server, the guideline cards, a scaffolded app's bootstrap) reads that module instead, so a fourth dial or a third palette reaches all of them without an edit. `ds dials` is the same roster from a terminal.

**Nothing may assume the value of a dial.** Not a component, not a docs page, not a test.

- **Never name a ramp step outside `palettes.css`.** `--signal-500` exists under every palette and is a different colour in each — amber in ember, teal in slate. A rule that paints one is asserting which brand is mounted. `component-css.test.mjs` fails the build on a base-scale paint for exactly this reason.
- **Never assume which way a state moves.** Ember's `--accent` is the 500 step with ink text and hover _lightens_ to 400. Slate's is the 600 step with white text and hover _darkens_ to 700 — and in slate dark it starts at 300 instead. Read `--accent-hover` / `--accent-press`; do not compute one from the other.
- **Never assume a foreground.** `--accent-fg` is ink under ember and white under slate. Anything that hardcodes "the accent takes dark text" is wrong under half the palettes. The bridge shipped that bug: `--color-warning-foreground` was aliased to `--fg-on-signal`, which is ink in ember and white in slate, so a warning label on the 1.87:1 yellow fill went to 1.87:1 the moment a second palette existed.
- **Never assume a size.** `--radius-md` is 6px on a desktop and 12px on a phone; `--fs-xs` is 12px and 13px. A component that hardcodes either has opted out of the platform dial.

`mobile.css` changes **no colour**, which is what keeps every measured ratio in this document true on a phone.

## Who owns which colour

Three families, three different answers to "does this change when the brand does":

- **Brand — yes.** `--signal-*`, `--anchor-*` and everything derived from them swap with `data-palette`. That is the point of the dial.
- **Status — no.** `--status-*` owns its own four hues, declared once and untouched by any `[data-palette]` block. Success is green because success is green, in every brand this system will ever carry. It used to be made of brand — `--status-success` was `--anchor-500` and `--status-warning` was `--signal-600`, which made a caution badge the exact colour of the primary CTA. An amber button beside an amber caution badge is not a signal, and under a teal palette it would have been a teal one.
- **Data — no.** `--chart-1` … `--chart-8` are eight hues at one lightness and one chroma, so no series shouts louder than another, ordered so consecutive slots are at least 90° apart. A chart does not restyle itself when the brand does. Plus `--chart-grid` (decorative, the `--border-strong` of a plot) and `--chart-axis` (3:1, a line that carries meaning).

`contrast.test.mjs` asserts the independence directly: every `--status-*` and `--chart-*` must resolve to the same value under every palette, and `--accent` must not — so the assertion cannot pass on a stylesheet where nothing varies at all.

## Adding a palette

1. Two blocks in `packages/tokens/src/palettes.css`, appended after the ones already there: `[data-palette='<name>']` and `[data-palette='<name>'][data-theme='dark'], [data-palette='<name>'].dark`. Each declares the **complete** semantic set.
2. Read the header of that file before you write them. The blocks are decided by specificity and then source order, and the consequence is not obvious: on `<name>` + dark, the palette's _light_ block outranks the ember _dark_ block, because they tie at (0,1,0) and the palette block is later. So the dark block cannot be a thin diff — anything the light block declares that dark must change, the dark block restates. That is why every block declares everything.
3. Add the palette to `PALETTES` in `packages/tokens/src/contrast.mjs`. That is the only registration; `COMBINATIONS`, the whole test suite, `ds dials`, `ds tokens`, the MCP server, the guideline cards and the scaffolded app's palette guard all widen from it. Each of those has a test that fails if it does not.
4. Measure. Every ratio goes in a trailing comment, and `contrast.test.mjs` gains two more measured columns per token. `unreadableSelectors()` fails the build on a block whose selector the resolver does not understand, so a palette added to the CSS and not to `PALETTES` cannot ship unmeasured.
5. Nothing else changes. `tokens.css` never names a ramp step, no component may assume which palette is mounted, and no surface that reports the dials carries a list of its own — `dials.test.mjs` pins `PALETTES` to the blocks `palettes.css` actually declares, in both directions, so a half-added palette fails rather than half-appearing.

The neutral ramp is on the same dial: a palette sets `--n-h` and `--n-mult`, and `tokens.css` mixes every `--ink-*` step as `oklch(<L>% calc(<C> * var(--n-mult)) var(--n-h))`. Because neither dial touches lightness and lightness is what carries contrast, a palette can go from near-achromatic to charcoal and **not one measured neutral ratio moves** — asserted in `contrast.test.mjs`, not taken on trust. Declare `--n-h`/`--n-mult` in the palette block and nowhere else: `:root` and `[data-palette='…']` tie at (0,1,0), and `tokens.css` is @imported _after_, so a default written there would beat every palette and the dial would never turn.

## Contrast: a color is not cleared for use until it is measured

**A new colour token is not usable until its ratio against `--bg` is measured and recorded, in both themes.** Put the number in a trailing comment on the declaration. `contrast.test.mjs` re-measures every one of them on each run, so a comment that drifts from the value is a failing build, not stale prose.

Thresholds are WCAG 2.2 AA: **4.5:1** for text (SC 1.4.3), **3:1** for a control boundary or any other non-text graphic that carries meaning (SC 1.4.11).

### Fill tokens and text tokens are different tokens

Each status state has five members, and they are not interchangeable:

| Member                 | Job                                                  | Floor      |
| ---------------------- | ---------------------------------------------------- | ---------- |
| `--status-X`           | the fill — a stripe, a dot, a badge. **Never text.** | 3:1        |
| `--status-X-on`        | the text drawn _on_ that fill                        | 4.5:1      |
| `--status-X-fg`        | status text on `--bg` / `--surface`                  | 4.5:1      |
| `--status-X-tint`      | the quiet panel background                           | —          |
| `--status-X-tint-edge` | that panel's hairline                                | decorative |

`--status-X-on` is the one a component gets wrong by hand, because it is not the same answer for all four: white on success, danger and info (5.17 / 5.41 / 5.06) and **ink** on warning (11.22). Reaching for `--fg-inverse` instead is the mistake the Tailwind bridge made — it is white in light and black in dark while the fill under it stays put, so it cannot be right in both themes. On the shipped bridge that was `text-info-foreground` at 3.88:1 in light and `text-destructive-foreground` at 4.38:1 in dark.

**Warning is the documented exception.** Yellow cannot reach 3:1 on white and still read as yellow; pushed dark enough to clear the floor it is olive, which is not a caution colour. So `--status-warning` is **1.87:1**, and a warning fill or rule must be edged with `--status-warning-border` (3.76:1 light, 11.22:1 dark), which is what actually carries SC 1.4.11. Painting a bare warning fill is a bug — `organisms/Toast.css` is the worked example of doing it right, and it is the only one of the four stripes that uses a `-border` token.

The same fill/text split applies to both brand colours, but **the numbers are the palette's, not the system's**. Under ember, `--accent` is a fill at 2.53:1 and `--anchor` is 8.13:1 on white and 2.58:1 on black; under slate the accent is 5.11:1 and could carry text. That is exactly why `--accent-ink` is a separate token rather than advice about which ramp step to pick: anything a user _reads_ in a brand colour uses `--accent-ink` or `--anchor-ink`, and those clear 4.5:1 in every palette × theme combination by construction.

`--accent-tint` / `--anchor-tint` are the brand counterpart to `--status-*-tint`: the soft chip or inset panel each ink is drawn on, measured as a pair in every combination (ember 8.96:1 light / 7.26:1 dark amber, 10.23:1 / 10.73:1 forest). Like the status tints they carry dark overrides — a tint that stays put while its ink inverts is the pair this whole section exists to prevent, and both of them were that bug: the dark values were left at the `50` step of each ramp, so a 97%-light chip sat on a black page carrying inverted text.

### A fill and the text on it move together, or neither does

A tinted panel whose background is fixed while its text is themed **inverts in dark mode**, and each token still passes its own check against `--bg` — so a per-token sweep cannot see it. `Alert`'s danger variant paired a fixed pink with a themed `--status-danger-fg` and landed at **2.40:1**.

The rule: if a rule sets both `background` and `color`, both come from tokens that theme, or both from fixed scale values. Never one of each. `contrast.test.mjs` asserts each `--status-*-tint`/`--status-*-fg` pair in both themes.

### Never paint a base-scale value in a component

`--ink-*`, `--signal-*` and `--anchor-*` are fixed — they do not respond to `[data-theme="dark"]`. A component that paints one is claiming the colour is right on a white page _and_ a black one. That claim was wrong seven times over: a black tab underline and switch track at 1.00:1, a black tooltip on a black page, a near-white badge fill under themed text at 1.37:1.

The two brand ramps carry a second claim on top of that one, and it is worse: they do not respond to `[data-palette]` either. `--signal-500` is amber under ember and teal under slate, so a component that paints it is asserting which brand is mounted as well as which theme. `--ink-*` is the one scale that survives a palette swap intact — it is mixed from the palette's own `--n-h`/`--n-mult` — but it still does not flip with the theme, so the rule is unchanged.

Reach for the semantic token that flips: `--fg`/`--bg`, `--bg-inverse`/`--fg-inverse` for a surface that must stay visible against either page, `--bg-muted` for an inset fill, `--border-control` for a control edge, `--accent-ink`, `--accent-tint`/`--anchor-tint`, `--status-*-tint`. `component-css.test.mjs` fails the build on a base-scale paint. Its exemption list is down to one geometry-only selector: `Badge`'s two brand chips were on it as deliberate fixed pairs until the brand tints gained dark values, and an exemption whose reason has expired is how a sweep goes quiet.

### Colour is never the only channel

SC 1.4.1 is separate from contrast and a passing ratio does not satisfy it. `Rating` drew filled and empty stars as the same ★ glyph in two colours, so the value was carried by colour alone — and the two states were only 2.66:1 apart. It draws ★ and ☆ now. If a state is signalled by colour, give it a second cue: a shape, a glyph, a label, a border.

### `--border-control` vs `--border`

- `--border` (1.24:1) and `--border-strong` (1.53:1) are **decorative**. They separate one surface from another — card seams, table rules, dividers, the edge of a floating panel — where nothing depends on seeing the line.
- `--border-control` (3.64:1 light, 3.95:1 dark) is for a **control boundary**: the edge that tells a user where an input, toggle, chip, or segmented control is. That edge is a meaningful non-text graphic under SC 1.4.11.
- The test: if the border were invisible, would the user lose the control? Then it is `--border-control`.
- The figures above are against `--bg`, and a control is not only drawn there. `contrast.test.mjs` measures `--border-control` on all five neutral surfaces in both themes; the narrowest is `--surface-3` in light at **3.26:1**, so there is roughly a quarter of a point of headroom and no room to dim the token.

Two layers enforce this, and neither is prose. `component-css.test.mjs` sweeps every component stylesheet here, with a named-exemption list for the selectors that read as controls and are not (`.ds-dropdown__content` and friends). Consumers get the same constraint as `@elirobinson-css/no-decorative-control-edge` from `@elirobinson/eslint-config/css`, and as the `control-edge-contrast` entry in `@elirobinson/ai-patterns/contracts`.

Same split on text: `--fg-4` (2.67:1) is a decorative, non-informational grey — a dimmed comparison series, a placeholder glyph. Text a user has to read uses `--fg-disabled` (4.85:1 light, 7.87:1 dark), including inside a disabled control.

### Exempting a token

`CONTRAST_RULES` in `packages/tokens/src/contrast.mjs` carries an `except` map. An entry there is a claim that the token never carries meaning, written down with its reason. Adding one is a deliberate decision, not a way to quiet the test.

There are two kinds of entry, and the difference matters. Most are "this token never carries meaning" — `--fg-4` is a decorative grey, `--chart-grid` is the `--border-strong` of a plot. `--status-warning` is the other kind: it _does_ carry meaning and it _cannot_ clear the floor, so the exemption names the token that carries the floor in its place, and `contrast.test.mjs` asserts that pairing from both sides — the fill under 3:1 and `--status-warning-border` over it. An exemption of that shape is only honest if something else is measured; otherwise it is a hole.

## Dark mode

- Dark values live under `[data-theme='dark'], .dark`. `[data-theme="dark"]` is the documented convention; `.dark` is a compatibility alias so a class-strategy switcher (`next-themes` defaults to one) works without silently doing nothing.
- Add a dark override for any token whose light value assumes a light background. `--focus-ring` is the cautionary tale: it was ink-on-white in both themes, which made every component's focus outline invisible on a black page. `--anchor` is the same shape of bug and still needs the lift — Forest at 42% L is 2.58:1 on a black page, so ember dark raises it to `--anchor-300` (8.13:1) and flips its foreground to ink.
- The status fills no longer need one. Each of the four was picked to clear 3:1 against a white page _and_ a black one, which is what lets a status colour mean the same thing in both themes; only the `-fg` and `-tint` members are re-picked. `--status-warning-border` is the exception in the other direction: on ink no lift is needed, so it resolves to the fill itself.
- Every combination is measured, not every theme. `contrast.test.mjs` resolves `var()` chains per palette × theme — every combination, not just the two themes — because the un-inverted tints passed a two-theme sweep the whole time they were broken.

## Overriding a token in a consumer app

- **`tokens.css` is unlayered, on purpose.** Unlayered declarations beat anything inside a cascade layer regardless of order, so **an override written inside `@layer base` — where a Next.js `globals.css` conventionally puts base styles — will not apply.** Use an unlayered `:root` block.
- The three font families are the exception that needs no cascade knowledge: each reads a `--ds-font-*-override` first.

  ```css
  :root {
    --ds-font-sans-override: var(--font-geist-sans);
    --ds-font-mono-override: var(--font-geist-mono);
  }
  ```

  That works from any layer because `tokens.css` never declares those properties — there is nothing for it to lose to. Keep it that way; declaring one here would break every consumer's override at once.

- Families get the hook because the value is the framework's to supply at runtime — `next/font` generates a hashed family name (`__Geist_e8ce0c`) and exposes it only through a CSS variable, so the literal `'Geist'` matches nothing it loaded. Everything else is ours to own; do not extend the hook without that justification.
- Adding a family means adding its `--ds-font-*-override` hook and a case to `font-override.test.mjs`.
- **A product that wants to own one signal rather than one token should reach for the product token layer instead of overriding here.** `--product-*` is a small fixed set of variables the components read _through_ a fallback to a system token, declared inside the consumer's own `[data-product]` scope — so the override is scoped to the product's subtree and a consumer that declares none of it gets the system palette unchanged. See [Product token layer](product-token-layer.md). The unlayered rule above applies there too, and for the same reason.

## Tailwind bridge

- `@elirobinson/tokens/tailwind.css` maps Tailwind v4's theme namespaces onto the semantic tokens. Consumers import it instead of maintaining the mapping themselves.
- Colors alias into `--color-*`, which has no overlap with our token names. The other namespaces (`--radius-*`, `--shadow-*`, `--font-*`, `--ease-*`) are spelled exactly like our tokens, so they go through `--ds-*` aliases — a direct `--radius-md: var(--radius-md)` compiles to a self-referencing declaration in Tailwind's theme layer.
- Everything is `@theme inline`, so utilities compile to `var(--token)` and keep responding to **all three dials** at runtime: `[data-theme="dark"]` flips them, `[data-palette="slate"]` re-brands them (`bg-accent` amber to teal, `text-accent-foreground` ink to white with it), and `[data-platform="mobile"]` re-sizes `rounded-md`. An alias written as a literal, or as anything but a bare `var()` of a token this package declares, snapshots a value at build time and silently stops answering to every dial at once.
- Adding a semantic token that a consumer would reasonably reach for through a utility means adding its alias here too. `--n-h` / `--n-mult` are the exception: they are ingredients of a colour, not a colour, and there is no utility shape for them. `--safe-t`/`-r`/`-b`/`-l` are deliberately unaliased too — a safe-area inset is almost always _added_ to an existing pad, and a bare `pb-safe-b` would replace it; write `pb-[calc(var(--space-4)+var(--safe-b))]`.
- The contrast split is aliased too, so a Tailwind consumer gets it without reading this file: `border-control` / `border-border` mirror the control-vs-decorative edge, `text-foreground-disabled` is the accessible disabled text, and each status has `bg-warning` (the fill), `text-warning-foreground` (what goes on it), `text-warning-ink` (the 4.5:1 text on the page), `bg-warning-tint` and `border-warning-tint-edge`. `border-warning-border` is the one that carries the 3:1 a bare `border-warning` cannot. `border-input` points at `--border-control`, since an input's own edge is a control boundary.
- `--spacing-target` / `-target-min` / `-target-lg` are named entries in Tailwind's spacing namespace, not a re-pointing of its scale — `min-h-target` exists and `p-4` still means what Tailwind means. The numeric `--spacing` base is left alone because this system's `--space-*` ramp is non-linear and cannot be expressed as a multiple of one number.
