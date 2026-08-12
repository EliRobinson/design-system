# Tokens

## Token-first rule

- Import `@elirobinson/tokens/tokens.css` in every app shell.
- Import JSON token data from `@elirobinson/tokens/tokens-data` or `@elirobinson/tokens/tokens.json` — not a package root barrel.
- Never hardcode spacing, radii, colors, or durations — use CSS custom properties from tokens.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`, etc.) in components, not raw scale values (`--ink-500`).

## Dark mode

- Dark values live under `[data-theme='dark'], .dark`. `[data-theme="dark"]` is the documented convention; `.dark` is a compatibility alias so a class-strategy switcher (`next-themes` defaults to one) works without silently doing nothing.
- Add a dark override for any token whose light value assumes a light background. `--focus-ring` is the cautionary tale: it was ink-on-white in both themes, which made every component's focus outline invisible on a black page.

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
