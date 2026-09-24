---
'@elirobinson/ai-patterns': patch
---

`checkTouchTargets` measures a control in a scrolling table with a frozen first column at a second
scroll position before failing it, so a compliant control is no longer failed, and an undersized
one no longer skipped, when that position brings it clear of the column (#248).

**What went wrong.** The check measures a control's hit area by walking out from its centre
with `document.elementFromPoint`, and the walk stops at the first point that does not route to the
control. Two versions of that went wrong inside a sideways-scrolling container, such as a wide
table's wrapper:

- **0.20.0 and earlier** did not scroll. A control across the wrapper's visible edge was walked
  where it stood, so a 44x44 button with 5px hidden reported `~39x44` and failed
  `touch-target-primary`. Whether it fired depended on the viewport width, so a table could pass at
  1280px and fail on a phone. 0.21.0 (#79) fixed this by scrolling each control to the centre
  of the window and of every scrolling ancestor before probing.
- **0.21.0 to 0.28.2** centred every control in its container, even one already in full view. In
  a narrow table with a frozen (sticky) first column and no `scroll-padding`, the centre can be
  under that column. A fully visible 44x44 button was moved partly under it and reported
  `~32x44`. A 30x30 button whose centre was moved under it was skipped as covered, and passed
  without being measured.

**The fix.** A control that misses its floor at the centre is put back and measured again with
`scrollIntoView({ block: 'nearest', inline: 'nearest' })`, which moves it only as far as its
container's near edge. If the control meets its floor there, it passes. If it misses at both, the
result closer to the floor is reported. The second placement can only rescue a control, never hide
one: an unmeasured result never replaces a measured one. Every scroll position the check changes
is still put back afterwards. Both placements honour `scroll-padding`, so a table that pads its scroll box past its frozen column is
measured clear of it. A control that is covered at both placements is still skipped without being
measured or reported, as before.

`checkHitAreaOverlap` keeps its single centred probe. There, a sibling moved under a frozen column
can only hide an overlap, never report a false one.

If you are on 0.28.2 or earlier, run `pnpm exec ds-resync` to move to this version.
