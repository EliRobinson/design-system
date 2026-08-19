---
'@elirobinson/tokens': minor
'@elirobinson/ai-patterns': minor
---

Add `miltinson`, a third palette: teal over indigo.

`data-palette="miltinson"` joins `ember` and `slate` on the palette dial. It is
the brand miltinsons.com and the other Miltinson properties render in, moved
onto the dial so those sites stop re-declaring `--accent*` in a local `:root`
block that no contrast gate can see. Nothing about `ember` or `slate` changes,
and an app that sets no `data-palette` is unaffected.

The three teals those properties already ship are pinned to ramp steps rather
than re-picked, so adopting the palette is a swap and not a redesign:

| Step           | Value     | Was                       |
| -------------- | --------- | ------------------------- |
| `--signal-300` | `#5eead4` | `teal-light`              |
| `--signal-500` | `#14b8a6` | `teal` — the resting fill |
| `--signal-600` | `#0d9488` | `teal-dark`               |

Structurally it follows `ember` rather than `slate`: `--accent` is the 500 step
carrying `--ink-1000`, hover **lightens** to 400 and press darkens to 600. Teal
peaks bright enough that the whole triad clears AA against its own fill in both
themes — 8.44 / 11.10 / 5.61, the same three numbers in light and dark — which
is what lets one `--accent-fg` serve both blocks. `slate` has to spend two
different foregrounds on the same problem because its teal is deeper.

`--anchor` is indigo, held about 90 degrees off the signal so a trust mark
never reads as a muted CTA, and pulled toward the neutral hue so it sits on the
greys rather than on top of them. `--anchor-400` is parked in the narrow band
that clears 4.5:1 against both white and black (4.61 / 4.55), the same trick
`slate` uses, which lets one step be the hover fill in light and the press fill
in dark.

### The neutral dial is 252, not the properties' own 286

Worth recording because it was measured rather than chosen. The properties'
charcoal sits at hue 286, and a palette declaring `--n-h: 286` fails
`contrast.test.mjs`: `--fg-2` measures 8.4490 under ember, 8.4485 under slate
and 8.4798 under miltinson, a spread of 0.031 against a `PALETTE_TOLERANCE` of
0.01. Lightness is untouched, but oklch chroma is not perfectly
luminance-neutral in sRGB and a 39-degree rotation is far enough to show up in
the second decimal.

Lowering `--n-mult` does not rescue it — the spread is hue-dominated and barely
responds. The passing band is roughly within 8 degrees of ember's 247, so the
palette takes `--n-h: 252` (slate's hue) at `--n-mult: 1` (ember's chroma), for
a spread of 0.004. At these chroma levels the difference between hue 252 and
286 is well under one 8-bit unit per channel; the identity a consumer sees is
carried by the teal and by the surfaces they pin themselves, not by the hue of
a near-achromatic grey.

### Ratio comments in `palettes.css` are not gated

Found while writing this: corrupting `--accent-ink`'s trailing `9.65:1` to
`4.11:1` leaves all 675 token tests green, though `docs/agents/tokens.md` says
a comment that drifts from its value is a failing build. That guarantee holds
for the tokens the `CONTRAST_RULES` sweep names and not for the palette blocks'
per-declaration comments. Every ratio in the new blocks was instead verified by
re-resolving it through `combinationValues()` and `contrastRatio()`; four
comments were off by 0.01–0.03 against the repo's own converter and were
corrected. Closing the gap properly is worth its own change.
