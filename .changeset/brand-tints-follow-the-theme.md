---
'@elirobinson/tokens': minor
'@elirobinson/react': patch
---

Give the brand tints dark values, and add `--anchor-ink`. Closes #60.

`--accent-tint` and `--anchor-tint` were the last colours in the system with no
dark override: `--signal-50` and `--anchor-50` stayed 96–97% light on a black
page. That reached consumers directly — both are aliased in the Tailwind bridge,
and `tailwind.css` recommends `bg-accent-tint` as the substitute for shadcn's
"accent as hover tint", so taking that advice produced a near-white block in
dark mode. They now mirror the way `--status-*-tint` already worked, a wash at
the same hue: `oklch(22% 0.05 70)` amber, `oklch(20% 0.04 160)` forest.

**New token: `--anchor-ink`** (`--anchor-600`, 11.41:1 light; `oklch(78% 0.13 160)`,
11.07:1 dark) — the forest counterpart to `--accent-ink`. `--anchor` itself is
8.13:1 on white but 2.58:1 on black, so forest text needed a token that inverts.
It is aliased as `text-anchor-ink`, and is measured against `--bg` in both
themes by the same rule that covers `--accent-ink`.

**`Badge`'s `signal` and `anchor` variants** painted the ramp directly
(`--signal-100`/`--signal-800`, `--anchor-100`/`--anchor-700`). Those were
self-consistent fixed pairs at 8.05:1 and 11.84:1 — and still a 94%-light chip
sitting beside a `default` badge that had inverted properly. They now paint
`--accent-tint`/`--accent-ink` and `--anchor-tint`/`--anchor-ink`: measured in
the browser at 8.96:1 light / 8.43:1 dark and 10.23:1 / 9.45:1, with the chip
now within 1.21:1 of the page in either theme instead of glaring against it.

Both variants are one ramp step lighter in light mode than before (the 50 step
rather than 100), which is what makes them share one tint token with every other
tinted brand surface. Text contrast goes up, not down.

With that, the exemption list in `component-css.test.mjs` is down to a single
geometry-only selector: the two badges were the reason it existed, and an
exemption that outlives its reason is how a sweep goes quiet. `contrast.test.mjs`
now asserts both tint pairs per theme.
