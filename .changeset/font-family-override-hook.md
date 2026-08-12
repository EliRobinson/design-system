---
'@elirobinson/tokens': minor
'@elirobinson/ai-patterns': minor
---

Give the font families a supported override hook, and write down the cascade
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
