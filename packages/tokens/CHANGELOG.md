# @elirobinson/tokens

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
