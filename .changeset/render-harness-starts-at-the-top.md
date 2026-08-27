---
'@elirobinson/ai-patterns': patch
---

Test-harness only: `render()` in the browser contract suite now resets the
viewport to the top of the document after `setContent`.

`setContent` replaces the document but does not reset the scroll offset, and the
offset survives whenever the incoming page is tall enough to hold it. Every fold
case in that file assumes a fresh render starts at the top, so a test that left
the page scrolled handed the next one a viewport already past the fold — green in
isolation, red in sequence, reporting a fold problem rather than a scroll one.

Nothing shipped changes; this is the suite that guards `checkTouchTargets` and
`checkHitAreaOverlap`, not the checks themselves.
