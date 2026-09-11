---
'@elirobinson/tokens': minor
'@elirobinson/ai-elements': patch
---

Add the `miltinson-tech` palette — navy signal over brick-red anchor, on
near-achromatic greys.

Two new blocks in `palettes.css` (7 light, 8 dark) and one new entry in
`PALETTES`. Everything that reads the dial widens from there: `ds dials`, the
`colors-palettes.html` guideline card, the MCP server, the contrast sweep and
the scaffolded app's palette guard all pick it up with no edit of their own.

The brand colour is Brick Red `#cb4154`, and it is the `--anchor` ramp rather
than `--signal`. `--status-danger` is palette-independent at hue 27 and the
brand is 10.4 degrees off it, so a primary CTA drawn in brick would sit beside
a destructive one as the same colour at a glance. Navy at hue 265 takes the
control layer instead — 8.57:1 as a fill with white text, against brick's
4.75:1 — which moves the collision out of the one layer where it costs data.
It does not delete it: brick still appears as anchor fills, brand tints, trust
marks and key stats, so a destructive control keeps its icon and its verb. The
trade the palette takes on knowingly is navy against `--status-info`, 15
degrees apart but separated by lightness and chroma.

Both brand triads fill at 500 with white text and darken on hover in light, and
both lift to 300/200/400 with ink text in dark — so this is the first palette
whose `--accent-fg` and `--anchor-fg` differ between its two themes. Read
`--accent-fg`, `--accent-hover` and `--accent-press`; a component that computes
one from another is broken by one of the two themes.

Two gates moved with it, both measured rather than relaxed on a hunch:

- `PALETTE_TOLERANCE` in `contrast.test.mjs` goes from 0.01 to 0.02. sRGB's
  luminance weights are not hue-symmetric, so hue 265 composites a hair darker
  than hue 247 at the same lightness. The widest spread across every neutral on
  every neutral surface in both themes went from 0.003:1 to 0.0149:1, on light
  `--fg-2` (8.4485 to 8.4633). A palette that actually tinted a grey by touching
  its lightness moves these by tenths of a point; this tolerance cannot hide one.
- The AI Elements accessibility sweep read its palette roster off a list typed
  into the spec. It now reads `PALETTES` from `@elirobinson/tokens/dials`, the
  same way it already reads its component roster off the build manifest — the
  list had already fallen behind and reported a clean three-palette run.
