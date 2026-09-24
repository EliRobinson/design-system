---
'@elirobinson/ai-patterns': patch
---

`checkTouchTargets` no longer reports a false positive on a control that straddles the edge of
a sideways-scrolling container, and this release pins that with tests.

**The false positive.** The check measures a control's hit area by walking out from its centre
with `document.elementFromPoint`. In 0.20.0 and earlier, a control inside a wide table's
scrolling wrapper that sat across the wrapper's visible edge was measured where it was: the walk
stopped at the clipped edge, so a 44x44 button with 5px hidden reported `~39x44` and failed
`touch-target-primary`. The user can scroll that button fully into view, so the report was
wrong. Whether it fired depended on the viewport width, so a table could pass at 1280px and fail
on a phone.

**The fix.** Since 0.21.0 (#79) the check scrolls each control into view before it probes, and
`scrollIntoView` scrolls every scrolling ancestor, not only the window. A straddling control is
brought fully inside its container and measured at its real size. Every scroll position the check
changes is put back afterwards. `scroll-padding` is honoured, so a table that pads its scroll box
past a frozen first column is measured clear of that column. A control still covered by something
else is skipped as unmeasurable, as before.

**New tests** (#248): a 44x44 button across the right edge, and across the left edge of a
scrolled strip, both pass; a 30x30 button in the strip still fails; a control under a frozen
column the page pads past is measured; the strip's and the window's scroll positions are
restored. Against 0.20.0 the straddling and frozen-column cases fail.

If you are on 0.20.x, run `pnpm exec ds-resync` to move to this version.
