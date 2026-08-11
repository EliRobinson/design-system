---
'@elirobinson/tokens': minor
---

Ship `@elirobinson/tokens/tailwind.css`, a Tailwind v4 bridge, and fix dark-mode focus and
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
