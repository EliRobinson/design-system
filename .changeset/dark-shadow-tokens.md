---
'@elirobinson/tokens': patch
---

Give every `--shadow-*` token a dark value. In dark mode the drop shadow is deeper and a light 1px ring draws the edge, so cards, popovers, menus and the SegmentedControl thumb show their elevation on the dark page. Light mode is unchanged. The Tailwind bridge's `--ds-*` aliases are now also declared on `[data-theme]` and `.dark`, so `shadow-*` utilities follow a dark subtree on a light page too.
