---
'@elirobinson/tokens': patch
---

Pin `--ink-100` and `--ink-200` to the sRGB their oklch already resolved to.

`oklch(96.2% 0.003 247)` is rgb(240.791, 242.572, 244.299) and
`oklch(92.8% 0.004 247)` is rgb(229.037, 231.391, 233.672), so they become
`#f1f3f4` and `#e5e7ea` and every solid fill paints the byte it painted before.
Computed analytically and confirmed against the browser's own resolved values,
which agree exactly.

What changes is that the rasteriser no longer performs the oklch → lab → sRGB
conversion — cube roots and a matrix multiply — to arrive there.

That conversion is the mechanism behind the visual-regression flake tracked in
issue #65. `--bg-muted` is `--ink-100` and `--border` is `--ink-200`, which
between them are the background and the 1px border of every code block, about
12 sRGB levels apart. Their 4px rounded corners blend across that narrow band,
and two builds of Skia that agree only to within a float epsilon round the
blended byte differently. Decoding the CI diffs pixel by pixel put every
failure on the corners of `pre.shiki` — `segmented-control` and `tooltip`
differed at exactly two coordinates, the top-right and bottom-right corner of
one block — always in the light theme, never in dark, where the border is
10%-alpha white over near-black and never lands in that band.

Deliberately only these two. The rest of the ramp stays in oklch, so CI has a
control group: if this is the mechanism, the flake disappears and nothing else
moves. Treat that as the confirming experiment rather than a settled result —
if it holds, the same pinning is worth considering for any token pair that ends
up adjacent on an antialiased edge.

Sibling to the gutter quantisation: one removes subpixel geometry drift, this
removes subpixel colour drift.

Also regenerates `tokens.json`, which had not been rebuilt after the gutter
change landed in `tokens.css`, so the committed artifact now matches its source.
