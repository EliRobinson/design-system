---
'@elirobinson/eslint-config': minor
'@elirobinson/ai-patterns': patch
'@elirobinson/react': patch
---

New rule `no-hardcoded-control-geometry`, in `designSystem()` and `designSystemCss()`: it flags a raw `44px` on a size property (use `var(--target)`) and a raw `2px` outline width or `outline-offset` (use `var(--focus-ring-width)` / `var(--focus-ring-offset)`). A token elsewhere in the value does not hide the literal, so `outline: 2px solid var(--focus-ring)` is caught. It ships at `warn`; raise it with `designSystem({ controlGeometry: { severity: 'error' } })` and `designSystemCss({ controlGeometrySeverity: 'error' })`.

`no-hardcoded-design-values` now exempts CSS system colours (`CanvasText`, `Highlight`, `ButtonBorder`, …), so a forced-colors block no longer needs a disable comment. The contracts name the new rule where they said a literal 44px was forbidden.
