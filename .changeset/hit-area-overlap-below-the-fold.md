---
'@elirobinson/ai-patterns': minor
---

`checkHitAreaOverlap()` can see below the fold, so a control that swallows its neighbour is
reported wherever it sits on the page.

`document.elementFromPoint` only answers for the visible viewport. Nothing scrolled, so a
sibling past the first screenful was probed at a coordinate the browser cannot see: it
answered `null`, `null` is neither the control nor contained by it, both branches of the
comparison were false, and the loop moved on having established nothing. Not a crash and not
a noisy false positive — a silent false negative on every page taller than the window, which
is the normal case rather than the edge case. `expectDesignSystemContracts(page)` certified
hit-area behaviour it had never measured, and a green result was indistinguishable from a
genuinely clean page.

This is the same defect [#79](https://github.com/EliRobinson/design-system/issues/79) /
[#133](https://github.com/EliRobinson/design-system/pull/133) fixed in `checkTouchTargets()`,
in the sibling function, left alone there so that PR stayed one function wide.

Each sibling is now scrolled into view — `scrollIntoView({ block: 'center', inline: 'center',
behavior: 'instant' })` — before its centre is probed, and its box is re-read afterwards. The
sibling is what moves, because the sibling's centre is what gets probed; the control is still
on top of it because the loop only ever walks `control.parentElement.children`, so the two
share a parent and scroll together. That is asserted rather than assumed.

**A probe that fails is no longer counted as a clean result.** Four answers replace two:

- **covered** — reported as `hit-area-no-overlap`, as before.
- **not covered** — silent, as before.
- **off-canvas**, which scrolling cannot rescue (a skip link at `top: -40px`, a closed
  drawer) — silent. Nothing a user cannot reach can be deprived of a hit area.
- **on screen and routed nothing** — reported as `hit-area-unmeasurable`, a stated gap in the
  check rather than a violation, mirroring `touch-target-unmeasurable`. Consumers holding a
  suite green may see this appear; it means a sibling went unchecked, not that a control is
  wrong. Look for `pointer-events`, a clipping ancestor, or a transform that moves the
  sibling off its box.

A sibling **taller than the viewport** is probed at the centre of whatever part of it is on
screen rather than excused. `checkTouchTargets` lets an unmeasurably large surface pass on
its painted geometry, because the question there is "is this box big enough" and an oversized
box plainly is. The question here is "is this sibling covered", and being tall is no reason to
stop asking.

The page is put back where it was found — every scrollable container, not just the window,
because `scrollIntoView` walks the whole ancestor chain. This check runs inside somebody
else's test, in front of somebody else's screenshot.

**What did not change:** the `sr-only` guard [#131](https://github.com/EliRobinson/design-system/pull/131)
added still runs, and now runs against the many more siblings reaching below the fold exposed.
`sr-only` is 1x1 at its control's static origin, so its centre routes to the control, and
probing it would report every accessible-name-only label on the page.

The scroll-and-probe block is a deliberate near-copy of the one in `checkTouchTargets`, not a
shared helper: #131 established that each check's helpers live inside its own `page.evaluate`
closure, which is serialised to the browser and cannot close over module scope, so sharing
would mean eval-ing a source string — ruled out by this module's strict-CSP promise. Both
copies now carry a note pointing at the other, because a silent divergence between them is
its own bug.

`tests/visual/contracts.ts` runs with `touchTargets: false` pending #65, so this repo's own
suite would not have caught it. The exposure was consumer-side.
