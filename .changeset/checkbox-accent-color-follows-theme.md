---
'@elirobinson/react': patch
---

Fix a checked `Checkbox` disappearing on a dark page, and widen the sweep that should have caught it.

`.ds-checkbox__input` painted `accent-color: var(--ink-1000)`. `accent-color`
is what fills the box when a native checkbox is checked, so the checked state
was pure black in both themes — 1.00:1 against a dark page, the same defect as
the tab underline and the switch track that the WCAG 2.2 AA pass fixed. It is
`var(--fg)` now: 21:1 in both themes.

It survived that pass because `scripts/component-css.test.mjs` matched painted
properties with a pattern that read the `-color` in `accent-color` as the tail
of a border property, so the declaration matched nothing and the sweep reported
the file clean. The property list is now explicit and also covers
`caret-color`, `outline-color`, `text-decoration-color`, `fill` and `stroke`.
No other component was painting a base-scale value through one of them.
