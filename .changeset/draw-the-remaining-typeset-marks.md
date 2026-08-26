---
'@elirobinson/react': minor
---

The five remaining controls that typeset their mark as a character now draw it.

`.ds-search-field__clear`, `.ds-toast__close`, `.ds-pagination__nav`,
`.ds-date-picker__header button` and the rating's stars rendered `×`, `‹`, `›`,
`★` and `☆` as text. On a native `<button>` that text is typeset in the UA
default, because `font-family` is not inherited — and where the ink then lands
inside the control is a property of that font file. `align-items: center`
centres a line box; the baseline sits below its centre by half the difference
between ascent and descent, and each family puts its ink somewhere else
relative to that. #146 measured the chip's remove at 0.05px off centre in the
UA default and 0.87px off in Geist: neither number was designed, and a consumer
re-pointing `--font-sans` would have moved it again.

All six now use the `Mark` component #146 introduced. A drawn mark has no
baseline and no metrics — its box is its own size, and its geometry is placed
so the path's bounding box is centred in the viewBox, so the ink centre is the
box centre is the control's centre. Measured in a browser across all seven call
sites: **0px residual on both axes**, rather than a small number that came out
well.

Two marks are new. `chevron-left` is derived from `chevron-right` by reflection
rather than written twice, so the pair cannot drift apart. `star` carries a
`filled` state — which stays a _shape_ difference, not a colour one: the
rating's two states were both `★` once, told apart by colour alone at 2.66:1
against the 3:1 SC 1.4.11 asks, and an outline against a solid is legible with
no colour vision at all. The star's radius is set so it paints 16.68px at
`--fs-lg` against the 16.67px the character painted, because a rating row that
quietly shrank by a fifth is not a fix.

Two controls also gained `display: inline-flex` — the date picker's month nav
and the rating's read-only star, neither of which was a flex container. A mark
is centred by the box it sits in, and on an inline element it would have sat on
the text baseline instead: the font-metric positioning this change exists to
get away from.

`marks.test.mjs` measures the bounding box of every entry and fails anything
not centred on (8, 8), so the guarantee is checked rather than asserted in a
comment. Nothing guarded the module before.
