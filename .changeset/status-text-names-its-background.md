---
'@elirobinson/tokens': patch
---

Name the reference background in every `--status-*-fg` annotation, and measure
status text on the neutral surfaces.

The four `--status-*-fg` tokens were the only meaningful foreground family in
`tokens.css` whose trailing annotations did not say what they were measured
against — `/* 11.41:1 */` rather than the `/* 3.64:1 on --bg */` that
`--border-control` two blocks up already carries — and the dark block carried no
label at all. The reference was documented six lines up in the section comment,
which is exactly where a reader scanning declarations does not look. A consuming
app read `--status-danger-fg: /* 7.55:1 */`, assumed a `--surface-2` row tint had
taken it under AA, and filed the wrong diagnosis. The tint costs 0.34; the text
measures 7.21:1.

All eight annotations now name `--bg`, and the section comment records the worst
neutral surface once per theme: on `--surface-3` the four sit at
10.22 / 8.68 / 6.76 / 6.46 in light and 9.54 / 9.55 / 6.80 / 8.25 in dark, at
most 1.54 below their `--bg` figure. No token value changed — every number was
already correct, and each reconciles to the hundredth with this package's own
`contrastRatio`.

`contrast.test.mjs` now measures all four against `--surface`, `--surface-2`,
`--surface-3`, `--bg-subtle` and `--bg-muted` in both themes, alongside the `--fg`
rows that established the pattern. Forty new assertions, all passing today; they
are what keeps the section comment honest if a surface or a status hue ever moves.
