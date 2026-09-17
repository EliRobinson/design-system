---
'@elirobinson/tokens': minor
---

Add the `steady` palette: Steady Azure signal over Miltinson Forest anchor, on
ember's near-achromatic greys. It changes one hue from ember and nothing else.

Select it with `data-palette="steady"`. Two new blocks in `palettes.css` and one
new entry in `PALETTES`, so `ds dials`, the MCP server, the palettes guideline
card, the contrast sweep and the scaffolded app's palette guard all pick it up.

Structure is slate's: `--accent` is the 600 step with white text (5.05:1), and
hover darkens to 700 (7.47:1). In dark, the accent lifts to 300 with ink text
(11.10:1), and hover still moves down the ramp, to 400. Every ratio is measured
in both themes. `--status-*` and `--chart-*` do not change, so `--status-warning`
stays Miltinson Amber.
