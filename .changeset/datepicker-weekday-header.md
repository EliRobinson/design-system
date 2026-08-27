---
'@elirobinson/react': minor
---

`DatePicker`'s calendar labels its columns, so which day is which stops being a
puzzle you can only solve if you already know the answer.

The calendar rendered as a `role="grid"` of week rows and seven
`role="gridcell"` children each, with **no header row at all** — no `Sun Mon Tue
…`, no `role="columnheader"`. Sighted and screen-reader users alike had one clue
to which column was which: the run of leading blanks before the 1st. That clue
only works backwards — you have to already know what weekday the 1st falls on to
read it, which is the thing the calendar was supposed to tell you. A screen
reader landing on a day announced the number and nothing else, because a grid
with no column headers has nothing to announce.

A `role="row"` of seven `role="columnheader"` cells now sits above the weeks:

```
Sun  Mon  Tue  Wed  Thu  Fri  Sat
```

**The labels come from `Date`, not from a literal array**, and are pinned to the
same explicit `'en-US'` locale the month label and the formatted value already
use, so the three agree instead of one drifting to whatever locale the runtime
happens to have:

```ts
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) =>
  new Date(2026, 10, 1 + index).toLocaleDateString('en-US', { weekday: 'short' }),
);
```

**`weekday: 'short'` (`Sun`), not `'narrow'` and not a two-letter form.**
`'narrow'` yields `S M T W T F S` — two pairs of identical labels, which
reintroduces the exact ambiguity this fixes. A two-letter `Su Mo` form is not
something `Intl` produces, so it means slicing locale output to a fixed width —
string surgery on a value whose length is the formatter's business. `'short'`
fits: the popover is 280px, less 12px padding a side and six 2px gaps, so a
column is ~35px and `Wed` sets at ~25px at `--fs-xs`.

**The header shares the week rows' grid track** (`.ds-date-picker__row` plus a
`--head` modifier) rather than declaring a second seven-column layout of its
own, so a label cannot drift out of the column it names.

`minor` rather than `patch` because rendered output changes for anyone
upgrading — the popover grows by one row — and on a 0.x package `minor` is the
breaking lane.

**This moves the `components-datepicker--open-{light,dark}` baselines** that
#177 minted, wide and narrow. That story is what makes the change reviewable at
all: before it, the calendar was only ever screenshotted closed.

**Three checks stop this regressing**, each confirmed red before it was trusted
green:

- The grid-shape test previously asserted every `role="row"` had exactly 7
  gridcells. A header row of columnheaders would have thrown there, so rather
  than relax it the assertion now states its real claim: `rows[0]` is a header
  of exactly 7 columnheaders named `Sun`…`Sat` (which also pins it _above_ the
  weeks, where a column header has to sit to label anything), the grid contains
  no other columnheader, and every remaining row is still a full 7 gridcells
  wide with no columnheader among them.
- A new test walks a full rendered week and asks `Date` what weekday each day
  actually falls on, comparing column by column against the rendered headers.
  This is what keeps the `2026-11-01` seed honest: a seed landing on the wrong
  weekday shifts every label and fails here, so the date is guarded rather than
  magic.
- `defaultOpen` gains the tests it shipped without in #177 — the calendar is
  open on first render, and it still closes when the input is clicked, which is
  the half of the contract that makes it uncontrolled rather than stuck open —
  alongside one asserting the picker stays closed without it.
