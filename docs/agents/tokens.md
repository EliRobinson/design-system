# Tokens

## Token-first rule

- Import `@elirobinson/tokens/tokens.css` in every app shell.
- Import JSON token data from `@elirobinson/tokens/tokens-data` or `@elirobinson/tokens/tokens.json` — not a package root barrel.
- Never hardcode spacing, radii, colors, or durations — use CSS custom properties from tokens.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`, etc.) in components, not raw scale values (`--ink-500`).

## Dark mode

- Dark values live under `[data-theme='dark'], .dark`. `[data-theme="dark"]` is the documented convention; `.dark` is a compatibility alias so a class-strategy switcher (`next-themes` defaults to one) works without silently doing nothing.
- Add a dark override for any token whose light value assumes a light background. `--focus-ring` is the cautionary tale: it was ink-on-white in both themes, which made every component's focus outline invisible on a black page.

## Tailwind bridge

- `@elirobinson/tokens/tailwind.css` maps Tailwind v4's theme namespaces onto the semantic tokens. Consumers import it instead of maintaining the mapping themselves.
- Colors alias into `--color-*`, which has no overlap with our token names. The other namespaces (`--radius-*`, `--shadow-*`, `--font-*`, `--ease-*`) are spelled exactly like our tokens, so they go through `--ds-*` aliases — a direct `--radius-md: var(--radius-md)` compiles to a self-referencing declaration in Tailwind's theme layer.
- Everything is `@theme inline`, so utilities compile to `var(--token)` and keep responding to `[data-theme="dark"]` at runtime.
- Adding a semantic token that a consumer would reasonably reach for through a utility means adding its alias here too.
