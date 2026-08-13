# Reporting kit

Stat cards with sparklines, a comparison line chart, a bar chart and a per-product table. `Charts.jsx` holds three small SVG chart primitives drawn from data — no chart library.

**Charting rules**

- **Ink is the current series; `--fg-4` dashed is the comparison.** Amber marks one thing only — the selected or highlighted member.
- **No gradients, no 3D, no shadows, no area fills.** Gridlines are `--border`, axis text is mono at 10px in `--fg-3`.
- **Never a pie chart.** Parts-of-a-whole go in a bar chart or a table.
- **Every delta names its comparison** ("+10.8% vs last month") and colours by direction: forest up, red down — never amber.
- **Say the counting rule.** The footnote about refunds being counted in the sale's month is the kind of honesty the brand owes.
- Charts carry `role="img"` and an `aria-label`; the table below is the accessible equivalent of the same data.
