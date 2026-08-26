---
'@elirobinson/ai-patterns': minor
'@elirobinson/tokens': minor
'@elirobinson/react': minor
'@elirobinson/design-system-mcp': patch
---

Dense affordances are measured against a 24x24 floor instead of being exempted
from measurement.

`checkTouchTargets()` used to have two states for a control: measured against
44x44, or not measured at all. `DENSE_AFFORDANCE_SELECTOR` and
`data-touch-target="dense"` both did the second thing, so an 8x8 tap target
carrying the attribute passed as cleanly as a 36px button did. There is now a
third state, which is the one the contract always meant: **measured, against the
dense floor.**

That floor is 24x24 — WCAG 2.2 **AA**, SC 2.5.8 Target Size Minimum, and the
`--target-min` token. 44x44 is AAA (SC 2.5.5) and this system's stricter
default, which is what makes a second floor a relaxation to the standard rather
than a discount off it. A dense control that misses 24x24 is reported under a
new violation kind, `touch-target-dense`, and every violation now carries
`contract` and `minimum` so the applied floor is readable without parsing the
message.

New exports: `MINIMUM_TOUCH_TARGET_DENSE` (24) and a `denseMinimum` option,
clamped to `minimum` so a relaxation can never come out stricter than the floor
it relaxes.

**This is a breaking change for anyone running these checks.** A consumer who
wrote `data-touch-target="dense"` on something under 24x24 has a green build
that goes red on upgrade with no code change of their own. That is the intended
effect — the attribute meant "stop looking" and now means "held to the
standard's floor" — but it is an upgrade cost, and it is why this is a `minor`
rather than a `patch`: on a 0.x package, `minor` is the breaking lane. It is not
a `major` only because that would mint `1.0.0`, which is a claim about the
package's overall API stability rather than about this change.

There is deliberately **no `data-touch-target="none"` escape hatch.** 24x24 is
the standard's own floor, so below it there is no principled number left to hold
a control to; and a marker meaning "stop looking" is exactly the suppression
habit this floor exists to end. The two cases that motivated the question are
already answered by measurement: a control nothing routes to is reported as
`touch-target-unmeasurable` rather than passing, and a control whose hit area
lives on its `<label>` is measured on the label. A page with a genuine exception
narrows `selector` or widens `exempt` at the call site, where it is visible in
the test and gets reviewed.

Two components move to keep the floor honest, and one token rule that was
already meant to.

- **`.ds-chip__remove` reaches 24x24 without repainting.** It was the one thing
  the system shipped under the floor: 22x22 painted, 22x22 effective, 2px short
  in both axes. The painted glyph stays 22px — MUI's own delete-icon scale — and
  the hit area now comes from a `--target-min`-sized `::after` centred on the
  control. Sized rather than negatively inset, so it is 24x24 in every condition
  including under `data-platform="mobile"`, and clears the chip label's centre by
  22px. `checkHitAreaOverlap()` reports nothing on it, asserted alongside the
  reach on both a normal and a one-character chip. The overlay is centred with
  negative margins rather than `transform: translate(-50%, -50%)`, so it creates
  no stacking context and hands nothing to the compositor: an overlay that
  changes how the glyph beneath it is rasterised is not a transparent overlay.

- **The chip's remove glyph is drawn, not typed.** It rendered the literal
  character `×`, which made the control's appearance depend on a font — and on a
  `<button>`, on a font nobody declared: `font-family` is not inherited, the UA
  stylesheet sets it, so the glyph came out in the UA default beside a Geist
  label. Declaring the family fixed the typeface and not the geometry:
  `align-items: center` centres a text node's line _box_, and where the ink
  lands inside it is a property of the family's own metrics. Measured as painted
  pixels, the same declaration centred the UA default's `×` to 0.063px and
  Geist's to 0.875px — neither number designed, and `--font-sans` is a token a
  consumer may re-point, which would move it again.

  A new internal module, `lib/marks.tsx`, draws it as an inline SVG instead:
  `currentColor` so every existing colour state keeps working, `aria-hidden`
  because the button already has its accessible name, sized by a `--mark-size`
  custom property the control sets from the type ramp, and geometry symmetric
  about the viewBox's centre. It is a replaced element centred by the flex box
  the control already declares, so there is no baseline and no metric involved.
  **Measured after: 0.000px from the chip's painted centre, and 0.000px at every
  tenth of a pixel through a full pixel of layout nudging.** The mark paints
  6.75px of ink against the text glyph's 6.00px — deliberately a little
  stronger, and visible in the before/after shots.

  **This changes rendered output.** `Chip`'s remove affordance is a drawn cross
  rather than a typed character; its hit area, its 22px painted box, and every
  number in the touch-target tables are unchanged.

  `.ds-chip` keeps a declared `font-family` — its label is genuinely text, and
  `<button class="ds-chip">` was painting that label in the UA default while
  `<span class="ds-chip">` painted it in Geist.

- **`.ds-table__sort` gets `min-height: var(--target-min)`.** It is the only
  element in the repo carrying `data-touch-target="dense"`, and it cleared 24 by
  0.45px of inline-box bleed over a 23.09px font-derived box with no
  `min-height` of its own. Stable across 40 subpixel/dpr permutations and still
  a rounding artefact: any header line-height change, or a consumer whose
  fallback font resolved differently, would have turned it red and looked like a
  contract regression. Painted height 23.09px → 24px.

- **The two halves of the mobile touch floor now agree, and they agree by
  excluding the dense affordances rather than inflating them.** `tokens.css`
  floors controls to 44px twice — under `:root[data-platform="mobile"]` (0,2,1)
  and under `@media (max-width: 480px) and (pointer: coarse)`, which led with a
  bare `button` at (0,0,1) and _lost_ to `.ds-chip` and `.ds-button--sm` (0,1,0).
  So a responsive coarse-pointer phone got a 32px `button.ds-chip` and a 36px
  `--sm` button, while the same page with the attribute set got 44px for both — a
  real divergence between two rules whose own comment calls them "the same
  floor".

  Both halves now carry the same exclusion list, naming exactly the selectors in
  `DENSE_AFFORDANCE_SELECTOR`, so a control the contract measures against 24x24
  is no longer simultaneously stretched to 44px on a phone. A chip stays 32px and
  a `size="sm"` button stays 36px in every condition. Inflating them would have
  discarded the scale they were drawn at (MUI's Chip, shadcn's `sm`) and bought
  nothing the dense floor was not already buying — the dense tier is a
  measurement, not an exemption, and that is the whole premise of this release.

  **This changes rendered output under `data-platform="mobile"` and on
  coarse-pointer phones under 480px**: every dense affordance — a chip's remove
  glyph, a search field's clear, a rating star, a calendar day, a `--sm` button,
  and anything marked `data-touch-target="dense"` — keeps its own height there
  instead of being floored to 44px. Responsive rendering for a chip and a `--sm`
  button is unchanged from before this release; what changed is that the
  `data-platform="mobile"` half now matches it. The two halves are pinned to one
  another, and to `DENSE_AFFORDANCE_SELECTOR`, by tests that fail on drift.

`.ds-chip` joins `DENSE_AFFORDANCE_SELECTOR`, which closes the separate finding
that a chip which is a control — `<a class="ds-chip">`, `<button class="ds-chip">`,
both sanctioned hand-written usages the React `<Chip>` cannot emit — was failing
the 44px floor latently, for consumers only. 32px is MUI's Chip exactly, which is
the reference scale this tier already cites, so "a chip is dense" was always the
right answer; what made it unwritable was that adding it here used to mean
_stopping measuring it_. Measured now: 64x32 and 63x32, clearing 24 comfortably.
`Chip` gains no new API and is not resized.
