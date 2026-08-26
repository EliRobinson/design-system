---
'@elirobinson/ai-patterns': patch
---

Fix `checkTouchTargets` never measuring anything below the fold.

`document.elementFromPoint` only answers for the visible viewport, and the hit
probe never scrolled, so every probe on a control below the fold returned
`null`. Originally that produced a literal `~1x1` violation on compliant
controls — arithmetic from a failed probe rather than a measurement — and since
the occlusion guard landed it produced silence instead: every primary control
below the fold was skipped without ever being checked, so a genuinely undersized
one passed. `expectDesignSystemContracts` was therefore only ever checking the
first screenful of a page.

Each surface is now scrolled into view before it is probed, its box re-read in
the resulting coordinate space, and the page put back exactly where the check
found it — window and scrollable containers both — so nothing downstream in the
same test sees a moved page. A surface larger than the window cannot be walked
to its edge, so it passes on its painted geometry instead of failing for being
too big to probe. And a `null` from `elementFromPoint` is now distinguished from
"something else is there": it is reported as `touch-target-unmeasurable`, a
stated gap in the check, never as a size the check did not obtain.
