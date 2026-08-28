---
'@elirobinson/react': minor
---

Anchored panels flip to the side that fits

A `DropdownMenu`, `Popover` or `Tooltip` whose panel does not fit below its
trigger now opens above it, and a start-aligned panel that overruns the right
edge of the viewport pins its right edge to the trigger's instead. `side` and
`align` become preferences rather than guarantees; nothing new to pass, and
`align: 'center'` is symmetric so a tooltip never flips horizontally.

Each axis flips at most once per open and never flips back. That is what keeps
a measure-then-reposition pass from oscillating: a decision free to move both
ways is re-made on every scroll event against a measurement its own last move
changed, and a panel sitting on the threshold chases it every frame.

Still no clamping — a panel that fits on neither side stays where it was asked
to go and overflows, which for a width-less fixed panel means its content
reflows rather than clipping. See #195.
