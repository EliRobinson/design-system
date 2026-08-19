# Tokens

## Token-first rule

- Import `@elirobinson/tokens/tokens.css` in every app shell.
- Import JSON token data from `@elirobinson/tokens/tokens-data` or `@elirobinson/tokens/tokens.json` — not a package root barrel.
- Never hardcode spacing, radii, colors, or durations — use CSS custom properties from tokens.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`, etc.) in components, not raw scale values (`--ink-500`).

## Contrast: a color is not cleared for use until it is measured

**A new colour token is not usable until its ratio against `--bg` is measured and recorded, in both themes.** Put the number in a trailing comment on the declaration. `contrast.test.mjs` re-measures every one of them on each run, so a comment that drifts from the value is a failing build, not stale prose.

Thresholds are WCAG 2.2 AA: **4.5:1** for text (SC 1.4.3), **3:1** for a control boundary or any other non-text graphic that carries meaning (SC 1.4.11).

### Fill tokens and text tokens are different tokens

`--status-*` is the **fill** — a stripe, a dot, a border. It only has to clear 3:1, and two of them have no headroom to be anything else (`--status-warning` is 3.69:1, `--status-info` 3.88:1). `--status-*-fg` is the **text**, at 4.5:1 or better against `--bg`. `--status-*-tint` is the **panel background** the `-fg` is drawn on. They are not interchangeable; painting a label in a fill token is the mistake the split exists to prevent.

The same split applies to both brand colours: `--accent` is a fill at 2.53:1 and `--anchor` is 8.13:1 on white but 2.58:1 on black, so anything a user _reads_ in either colour uses `--accent-ink` (9.69:1 light, 10.17:1 dark) or `--anchor-ink` (11.41:1 / 11.07:1) — a filled rating star, a slider thumb, a label.

`--accent-tint` / `--anchor-tint` are the brand counterpart to `--status-*-tint`: the soft chip or inset panel each ink is drawn on, measured as a pair in both themes (8.96:1 / 8.43:1 amber, 10.23:1 / 9.45:1 forest). Like the status tints they carry dark overrides — a tint that stays put while its ink inverts is the pair this whole section exists to prevent.

### A fill and the text on it move together, or neither does

A tinted panel whose background is fixed while its text is themed **inverts in dark mode**, and each token still passes its own check against `--bg` — so a per-token sweep cannot see it. `Alert`'s danger variant paired a fixed pink with a themed `--status-danger-fg` and landed at **2.40:1**.

The rule: if a rule sets both `background` and `color`, both come from tokens that theme, or both from fixed scale values. Never one of each. `contrast.test.mjs` asserts each `--status-*-tint`/`--status-*-fg` pair in both themes.

### Never paint a base-scale value in a component

`--ink-*`, `--signal-*` and `--anchor-*` are fixed — they do not respond to `[data-theme="dark"]`. A component that paints one is claiming the colour is right on a white page _and_ a black one. That claim was wrong seven times over: a black tab underline and switch track at 1.00:1, a black tooltip on a black page, a near-white badge fill under themed text at 1.37:1.

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

## Dark mode

- Dark values live under `[data-theme='dark'], .dark`. `[data-theme="dark"]` is the documented convention; `.dark` is a compatibility alias so a class-strategy switcher (`next-themes` defaults to one) works without silently doing nothing.
- Add a dark override for any token whose light value assumes a light background. `--focus-ring` is the cautionary tale: it was ink-on-white in both themes, which made every component's focus outline invisible on a black page. `--status-success` was the same shape of bug — forest green is a dark-on-light colour, and at 2.58:1 on a black page the Toast stripe it paints missed SC 1.4.11 until it got a dark override.
- Both themes are measured. `contrast.test.mjs` resolves `var()` chains per theme, so a token that only fails in dark mode fails the build.

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

## Tailwind bridge

- `@elirobinson/tokens/tailwind.css` maps Tailwind v4's theme namespaces onto the semantic tokens. Consumers import it instead of maintaining the mapping themselves.
- Colors alias into `--color-*`, which has no overlap with our token names. The other namespaces (`--radius-*`, `--shadow-*`, `--font-*`, `--ease-*`) are spelled exactly like our tokens, so they go through `--ds-*` aliases — a direct `--radius-md: var(--radius-md)` compiles to a self-referencing declaration in Tailwind's theme layer.
- Everything is `@theme inline`, so utilities compile to `var(--token)` and keep responding to `[data-theme="dark"]` at runtime.
- Adding a semantic token that a consumer would reasonably reach for through a utility means adding its alias here too.
- The contrast split is aliased too, so a Tailwind consumer gets it without reading this file: `border-control` / `border-border` mirror the control-vs-decorative edge, `text-foreground-disabled` is the accessible disabled text, and each status has both `bg-warning` (the fill) and `text-warning-ink` (the 4.5:1 text). `border-input` points at `--border-control`, since an input's own edge is a control boundary.
