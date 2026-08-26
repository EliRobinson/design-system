---
'@elirobinson/ai-patterns': patch
---

Stop `checkHitAreaOverlap` reporting an `sr-only` sibling as a swallowed
neighbour.

The canonical `sr-only` element is `1px x 1px` — deliberately not `0x0`, because
a genuinely zero-sized element is dropped from the accessibility tree in some
browsers — and the check's only size guard was `rect.width === 0 || rect.height
=== 0`. It missed by exactly one pixel. Sitting at its control's static origin,
such a label's centre lands on the control, so `elementFromPoint` returned the
control and every accessible-name-only label came back as a violation: 23 pairs
on a single consumer page, none of them actionable, and the message's advice
("bound the overlay") unfollowable for a control that has no overlay.

Siblings that are not visually rendered are now skipped: `visibility: hidden`,
`display: none`, `opacity: 0`, `clip-path: inset(50%)`, and — the general clause
that covers every `sr-only` variant in the wild — anything measuring `1px` or
less in both axes. A control that genuinely covers a _visible_ sibling is still
reported.
