# @elirobinson/tokens

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
