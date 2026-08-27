---
'@elirobinson/react': minor
---

The accordion's `+` and `−` are drawn marks. Nothing in the library typesets a
glyph any more.

`.ds-accordion__trigger::after` set `content: '+'`, and the open state swapped it
for `content: '\2212'`. Those were the last two character-drawn marks in the
system. #166 converted six controls and did not reach these, for a reason that
is also why this is not a one-line change: **a pseudo-element cannot hold an
`<svg>`**, so the trigger had to start rendering a real element.

Measured on the shipped component, at `--fs-sm` in a 44px trigger:

|               | painted ink   | offset from the trigger's centre |
| ------------- | ------------- | -------------------------------- |
| character `+` | 7.00 × 6.75px | **0.875px low**                  |
| drawn `plus`  | 6.50 × 6.50px | **0.000**                        |

The 0.875px is the same Geist offset #146 measured on the chip's `×`, and it is
not tunable for the same reason: `align-items: center` centres a text node's
line box, and where the ink sits inside it belongs to the font. The drawn mark
is also square, which the typeset `+` was not.

`plus` and `minus` are drawn at **5..11 — `cross`'s extent**, not a number tuned
for them. They are the same family at the same scale, and matching a sibling is
a rule that survives a seventh mark being added; it costs a quarter pixel
against the character it replaces. `minus` is the horizontal stroke of `plus`,
so the pair reads as one control changing state rather than two unrelated
glyphs.

**`minus` is the first one-dimensional mark**, and it found a check that was
measuring the wrong thing. `marks.test.mjs` required both sides of a mark's
bounding box to be at least 3 units, to catch a path that had lost its
coordinates and collapsed to a point. `minus` has every point at `y = 8`, so its
box is 6 × 0 and it failed while being exactly right. The bound now applies to
the **longer** side only, which still catches the collapse it was written for —
a vanished path has a longest side of 0. Nothing is lost: these marks are
stroked, so what a reader sees in the thin direction is the stroke width, and a
path 0.5 units tall and one 0 units tall paint the same bar once
`stroke-linecap: round` is applied. The floor the old check implied is kept as
its own assertion — a mark must have at least two points.

**The open/closed swap moved out of CSS.** There is no `--open` selector any
more: the trigger renders `minus` instead of `plus`, so which mark is painted is
a fact about the component rather than a second rule that has to be kept in step
with it. Only the colour is left in the stylesheet.

Incidentally an accessibility improvement: CSS `content` is announced by some
screen readers, and the mark is an `aria-hidden` SVG. The trigger's state was
already carried properly by `aria-expanded`.

**The centring contract was too strong, and this is what showed it.**
`assertMarksCentred` asserted every mark sits on its control's centre in both
axes. The accordion trigger is `justify-content: space-between` — the mark
belongs hard against the right edge — and the check reported it **617px off
centre in x**. The claim was wrong, not the layout. A flex box promises the axis
it says it centres, so each axis is now asserted only where the control claims
it: `justify-content` for the main axis, `align-items` for the cross one.

That would be a hole if a control could opt out of both, so it cannot — a mark
whose parent centres it on neither axis fails outright. That is the shape of the
regression the contract exists for, and it was re-confirmed: deleting
`display: inline-flex` from `.ds-rating__star` still fails, now with
`centres its mark on neither axis — is it still a flex container?` instead of a
bare pixel count, which names the cause rather than the symptom.

`Accordion` joins the adoption test, which asserts each control paints the
expected **number** of marks and typesets none of `×✕✖★☆‹›+−`.
