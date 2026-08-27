---
'@elirobinson/react': minor
---

DatePicker accepts `defaultOpen`, which renders it with the calendar already
open. Clicking the trigger was previously the only way to reach the popover,
its month header, the day grid and the `--today` / `--selected` day states, so
nothing that renders without interacting — a story, a demo, a screenshot —
could show them.

The popover is also anchored to the field's bottom edge (`top: 100%`) rather
than left at its static position. Static position only means "below the input"
while `.ds-date-picker` keeps the `display: inline-block` this package ships:
a wrapper class that sets `display: flex` or `grid` — constraining the field's
width is enough — moved the whole calendar on top of the field instead. It
renders identically under the shipped `display`.
