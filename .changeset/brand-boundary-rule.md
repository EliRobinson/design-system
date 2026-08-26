---
'@elirobinson/ai-patterns': patch
---

The shipped wordmark follows the palette dial, and the UI kits are guarded against colour
literals.

`ui_kits/_shared/Primitives.jsx` painted the wordmark's period `oklch(72.5% 0.175 65)` —
`--signal-500` under `ember`, written as a constant — so the wordmark stayed amber under
`data-palette="slate"` and under `data-palette="miltinson"`, which is the palette
miltinsons.com actually renders in. It now reads `var(--accent)`.

It was not the only one. Four of the nine JSX kit files carried colour literals: white and
black text, hairline borders and card shadows written as `oklch(100% 0 0 / …)` and
`#fff`/`#0a0a0a`. Each now reads a token, and the three that needed a specific alpha keep
it exactly, built with `color-mix()` from a token rather than restated as a literal.

They survived because `eslint.config.mjs` ignores `design-system-docs/**` wholesale, so
`no-hardcoded-design-values` never saw them. The kits are static JSX and HTML with no build
step, so un-ignoring them would cascade; a test guards the tree instead. Its detector strips
comments before matching, so a `#119`-shaped issue reference in prose is not mistaken for a
colour, and a table of cases pins both halves of that behaviour.
