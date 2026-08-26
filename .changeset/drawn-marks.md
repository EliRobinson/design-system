---
'@elirobinson/react': minor
---

The remaining five controls draw their mark instead of typesetting it.

Six controls painted their mark as a **literal character**, so where the ink
landed was a property of a font file rather than a design. `.ds-chip__remove`
became a drawn SVG in #146; this is the other five adopting the same pattern:

| control                                   | was       | now                              |
| ----------------------------------------- | --------- | -------------------------------- |
| `.ds-search-field__clear`                 | `×`       | `cross`                          |
| `.ds-toast__close`                        | `×`       | `cross`                          |
| `.ds-rating__button` / `.ds-rating__star` | `★` / `☆` | `star`, filled or not            |
| `.ds-pagination__nav`                     | `‹` `›`   | `chevron-left` / `chevron-right` |
| `.ds-date-picker__header button`          | `‹` `›`   | `chevron-left` / `chevron-right` |

**#167 made this worse before it made it better, which is why it is worth doing
now.** That change gave every native control `font-family: inherit`, so these
six went from the UA's Arial to Geist — and `align-items: center` centres a
text node's _line box_, not its ink, so the glyph moved to wherever Geist puts
it relative to its own baseline. #146 measured that swap on the chip's `×` at
0.05px → 0.87px off centre. The Geist rendering is the one shipping today.

Measured on the shipped components, painted ink against the control's centre:

| control                   | character                | drawn mark |
| ------------------------- | ------------------------ | ---------- |
| `.ds-search-field__clear` | 1.250px low              | **0.000**  |
| `.ds-toast__close`        | 0.750px low              | **0.000**  |
| `.ds-rating__button`      | 0.250px low, 0.125 right | **0.000**  |
| `.ds-pagination__nav`     | **1.438px low**          | **0.000**  |

Two new mark shapes, and the two questions #166 raised about them:

**The star is one shape in two states, not two shapes.** `Rating` tells filled
from empty by SHAPE rather than colour — colour alone is SC 1.4.1, and the two
states measure only 2.66:1 apart, under the 3:1 SC 1.4.11 asks between adjacent
meaningful graphics. Solid-versus-outline is exactly the distinction `★` and `☆`
carried, so `filled` toggles the fill on the same path. The stroke stays on
underneath, which is what keeps both states the same outer size so a row does
not change width as it fills.

A five-pointed star is also the first mark that **cannot** be symmetric about
its centre — one point up, two down — which generalised the module's contract.
What actually has to hold is that the path's BOUNDING BOX is centred on (8, 8);
symmetry was only ever one way to get there. The star spans `R` above its centre
and `0.809R` below, so its points are generated and then translated 0.62 units,
baked into the coordinates. Ink measured at 16.00 x 15.00px against the
character's 15.75 x 15.00 — the same mark at the same size, centred.

**The directional pair ships as two paths, not one plus a transform.** The call
site decides it: a transform is a rule the _control_ would carry, and
per-control geometry is what this module exists to remove. It is also not free —
measured at 8x device scale, `scaleX(-1)` differs from the drawn path in 18 of
16384 subpixels and `rotate(180deg)` in 13, max delta 8/255. Invisible, real,
and avoidable for one line of path data.

**Two controls gained `display: inline-flex`**, and that is load-bearing rather
than tidying. `.ds-rating__star` and `.ds-date-picker__header button` were not
flex containers, and an inline replaced element sits on the **text baseline** —
so an `<svg>` dropped into either would have put the mark's position straight
back under font metrics, in a new spelling. `stroke-linejoin: round` is
load-bearing for the same kind of reason, now documented in marks.css: a
`miter` join extends each vertex along its own bisector by an amount that
depends on the angle, and the star's 36-degree points and 108-degree notches are
nothing alike.

**This changes rendered output** for all five controls. Colours are untouched —
every mark is `currentColor`, so each control's existing hover, focus, disabled
and `--filled` states keep working with no new rules — and no control gains an
accessible name, because every mark is `aria-hidden` and every one of these
buttons already had one.

**Three checks, each confirmed to fail before being trusted:**

- `packages/react/src/lib/marks.test.tsx` proves the centring by **arithmetic**
  rather than by pixels: every path's bounding box is centred on (8, 8)
  _exactly_. A painted measurement can only resolve to half a device pixel, so
  it could pass a mark that is 0.1 units off and call it zero; this cannot. It
  also pins the straight-line-only contract that makes that arithmetic valid.
- The same file asserts **all six controls** actually render a mark and typeset
  no glyph — checked on rendered output, because a component can import `Mark`
  and still leave a character somewhere else.
- `tests/visual/contracts.ts` adds a browser-settled contract, run against every
  story: each mark's box centre coincides with its control's content-box centre.
  Boxes, not pixels, deliberately — painted ink snaps to the device grid, so a
  control at a fractional page position paints its mark up to a pixel from where
  the float geometry puts it (measured: 0.391px on `.ds-rating__star`, 0.219px
  on `.ds-pagination__nav`, in both cases exactly that control's own distance to
  the grid — the control snaps and the mark snaps with it). Comparing boxes to
  boxes takes the raster out of it and lets the assertion demand zero.

Known gap, stated rather than left to be discovered: `SearchField`, `Toast` and
`DatePicker` render no mark in their default stories — the field is empty, the
toast is closed, the calendar is closed — so three of the six have **no visual
baseline** covering their mark. The adoption is covered by the jsdom test above;
only the screenshot is missing.

`minor` because it changes rendered output. No component API changes; `Mark`
gains a `filled` prop and stays internal to the package.
