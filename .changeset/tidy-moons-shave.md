---
'@elirobinson/react': minor
---

`NavigationMenu`: make `href` optional on `NavigationMenuItem`. An item without one renders
as an inert `<span>` group label instead of an `<a>` — not focusable, not a navigation
target, and never marked as the current page — and names its nested list via
`aria-labelledby`.

Previously a section header had to borrow its first child's href to satisfy the required
`href`, which made the header render as active whenever that child was open and emitted a
second `aria-current="page"` alongside the real one.
