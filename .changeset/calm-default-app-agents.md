---
'@elirobinson/ai-patterns': patch
'@elirobinson/tokens': patch
---

The Tailwind v4 CSS-entry order is now stated the same way everywhere: `tailwindcss`, then the design system stylesheet (`@elirobinson/react/styles.css`, or `@elirobinson/tokens/tokens.css` without it), then `@elirobinson/tokens/tailwind.css`. That covers the generated `design-system-reference` skill and the Usage comment at the top of `tokens/tailwind.css`, which used to show only the `tokens.css` case. The AGENTS.md block and Cursor rule written by `init --agents` now say that on Tailwind v4 the app shell import of `styles.css` is that CSS entry. Re-run `ds-resync artifacts --write` and `init --agents --force` to refresh files written by an earlier version.
