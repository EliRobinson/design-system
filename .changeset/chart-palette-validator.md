---
'@elirobinson/tokens': patch
'@elirobinson/react': patch
---

Re-pick the chart colours so both themes pass the dataviz palette validator, and
make SegmentedControl's selected option visible in dark mode (#252).

`--chart-1` moves from hue 25 to 10 and `--chart-8` from 340 to 335, in both
themes. At hue 25, `--chart-1` and `--chart-3` were ΔE 5.0 apart under simulated
deuteranopia in light and 4.6 in dark, below the floor of 6; they are now 8.1
apart. The dark values drop from `oklch(74% 0.12 …)` to `oklch(66% 0.13 …)`,
inside the validator's 0.48–0.67 dark lightness band, and still clear 4.5:1 on
`--bg` (6.33–7.28:1). Every adjacent pair is now at least ΔE 8.2 apart for protan
and deutan readers in both themes. Slot order and the one-lightness,
one-chroma rule are unchanged. `chart-palette.test.mjs` runs the same checks on
every build.

`@elirobinson/tokens/color` also exports `srgbToLinear` and `linearSrgbToOklab`,
the two conversions that check is built on.

SegmentedControl's selected option had the same fill as the track in dark mode
(`--surface` and `--bg-subtle` are both ink-950), and its shadow was black on
black. It now carries an inset `--border-control` ring, 3:1 or more against the
fill and the track in every palette and theme. The ring also shows in light
mode.
