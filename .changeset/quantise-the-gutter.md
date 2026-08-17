---
'@elirobinson/tokens': patch
---

Quantise `--gutter` to whole pixels.

`--gutter` was `max(20px, 4vw)`. At a 1280px viewport that is 51.2px, and the
fraction does not stay where it starts: it becomes the inline origin of every
shell padded with it, so the grid track after a 260px sidebar and a 64px gap
lands on 853.625px rather than 852px, and every full-width rule, table and code
block inside that column ends up with partially-covered pixels at both ends.

Partial coverage is where determinism goes. The interior of those elements
rasterises identically every time; the end caps round inconsistently, so
pixel-exact snapshots of the docs site failed by one to four pixels on a
rotating set of pages — never the same set twice, never in the middle of
anything, always at x = the column's left and right edges. It read like flake
because the symptom moved. It was arithmetic.

`round(4vw, 4px)` keeps the gutter responsive and removes the fraction at the
source: the result is always a whole number of pixels, at any viewport width.
Below roughly 500px the `max()` still resolves to the flat 20px, so narrow
layouts are byte-for-byte what they were.

Consumers see the gutter move by at most 2px at a given width — 51.2px becomes
52px at 1280. Any layout that was pixel-snapping around the old fractional value
will settle onto whole pixels instead.

Note this uses CSS `round()`, which is newer than the `oklch()` this stylesheet
already depends on throughout. Browsers old enough to lack it would have lost
the colour system first.
