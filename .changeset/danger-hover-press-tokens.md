---
'@elirobinson/tokens': minor
'@elirobinson/react': patch
---

Add `--status-danger-hover` and `--status-danger-press` fills (Tailwind: `bg-destructive-hover`, `bg-destructive-press`). They darken on a white page and lighten on ink, and each clears 3:1 on the page with `--status-danger-on` at 4.5:1 or more on it, in every palette and theme. `Button variant="destructive"` now fills its hover and pressed states with them instead of drawing an inner ring.
