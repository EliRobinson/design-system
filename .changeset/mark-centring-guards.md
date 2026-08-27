---
'@elirobinson/react': patch
---

Two guards behind the drawn marks: the controls really adopted them, and the
controls really centre them.

Test-only. No component, stylesheet or rendered output changes.

`scripts/marks.test.mjs` (#172) proves the marks themselves are right — centred
in their viewBox, the chevron pair a true reflection, the element hidden from
assistive technology. It is arithmetic about the mark, and two things sit
outside what it can see.

**Nothing asserted that any control had adopted a mark.** That file never
imports a component, so every assertion in it would pass on a library where
`Mark` existed and nothing used it — which is the state #166 was moving out of.
`src/lib/marks-adoption.test.tsx` renders all six and checks the count, not just
presence: a `Rating` painting one star for five values, or a `Pagination` that
converted `‹` and left `›`, is half-converted and would satisfy a
"contains a mark" check. It also asserts each control typesets none of
`×✕✖★☆‹›`, because a control can render a mark and still leave a character
elsewhere in its tree. `DatePicker` uses the `defaultOpen` prop #177 added
rather than driving a click.

**Nothing asserted that a control centres the mark it paints.** A mark cannot
drift the way a character did — it has no baseline — but it can be dropped into
a control that does not centre it, and then the glyph is off-centre again for a
new reason. That is not hypothetical: `.ds-rating__star` and
`.ds-date-picker__header button` were not flex containers before #172, so an
inline `<svg>` in either would have sat on the text baseline and reproduced the
whole problem. Both gained `display: inline-flex` there — and until now nothing
failed if one lost it again. Measured by deleting those three lines:
**2.844px off centre**, with the arithmetic test still green.

`assertMarksCentred` in `tests/visual/contracts.ts` closes that, run against
every story: each mark's box centre must coincide with its control's content-box
centre, to within 0.001px.

**Boxes, not pixels, and that is what lets it demand zero** rather than carry a
tolerance. Painted ink snaps to the device grid, so a control that lands on a
fractional page position paints its mark up to a pixel from where the float
geometry puts it — measured at 0.391px on `.ds-rating__star` and 0.219px on
`.ds-pagination__nav`, in both cases exactly that control's own distance to the
grid. The control snaps and the mark snaps with it, so what a reader sees stays
centred; only a comparison against unsnapped geometry shows a residual. The
content box is compared rather than the border box because a mark centres in the
content box — they coincide for every control today, and would stop coinciding
the day one gains asymmetric padding.

The contract is exported, which is deliberate: it runs from `afterCapture`,
which fires only after the screenshot assertion passes, and outside the pinned
container every baseline mismatches — so on a developer machine the screenshot
always throws first and it never executes. Exporting it is what makes it
reachable from a throwaway spec. Verified that way against chip, both rating
stories, pagination, the sortable table and the new `datepicker--open` story,
and confirmed to fail on the mutation above before being trusted.
