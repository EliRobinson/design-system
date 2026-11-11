---
'@elirobinson/tokens': patch
---

`parseColor`, `toHex` and `contrastRatio` now read `calc()` inside `oklch()` (a product of two numbers, as the ink scale uses), so the neutral ramp gets a hex value and a contrast ratio. `aaVerdict` takes an optional second argument, `'non-text'`, which grades against 3:1 alone and never answers "AA large only".
