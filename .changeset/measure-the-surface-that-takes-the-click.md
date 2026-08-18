---
'@elirobinson/ai-patterns': minor
'@elirobinson/react': patch
---

Measure the surface that actually takes the click. Closes #65.

Running the published browser contracts against this repo's own components for
the first time produced 62 touch-target and 2 focus-visible findings across 84
stories in both themes. Four of the 62 were real. The rest were the checks
measuring the wrong element, and every one of them reaches consumers.

**`DENSE_AFFORDANCE_SELECTOR` named a glyph, not a control.** It listed
`.ds-rating__star`, which Rating puts on the `<span>` inside the button — the
control is `button.ds-rating__button`. The documented exemption had never
matched anything, so the affordance the contract explicitly carves out was
failing the contract. `.ds-calendar__day` went the same way for a different
reason: there is no Calendar component, and an exemption that outlives its
reason is how a sweep goes quiet. Both are now asserted against markup rather
than against the string, because a class list is only as good as the elements it
lands on.

**A form control's hit area is not always the control.** A `<label>` forwards
its clicks, so in the standard "18x18 native input, real text label" pairing the
label is what a finger goes for, and measuring the box measures something nobody
aims at. `checkTouchTargets` now passes a control when either its own hit area
or a single label that activates it clears 44x44. It has to be one surface: an
input and a label 12px apart do not add up to one 44px target, and treating them
as if they did would pass every checkbox ever written. An unlabelled 18x18
checkbox still fails, and so does one whose label is a 20px sliver of text.

**Controls nothing routes to are no longer reported as 1x1.** The reach walk
starts at ±1px and never tested the centre, so it could not tell "tiny" from
"occluded". With a modal `<dialog>` open Chromium attributes hits over the
`::backdrop` to the dialog, so every control behind it measured 1x1 — an
untouched 186x44 button was told to add padding, which would have done nothing.
`checkFocusVisible` had the mirror of the same bug: focus is refused on an inert
control, the snapshots match trivially, and a control with a perfectly good ring
was reported as missing one. Both now skip what they cannot validly measure.
Any consumer page with an open `Dialog`, `Sheet` or `CommandPalette` was hitting
this.

`TouchTargetViolation` gains optional `labelWidth` / `labelHeight`, reported
when a label was considered and was also too small, so the message says what was
measured instead of leaving the reader to wonder why the label next door did not
rescue an 18x18 box.

**In `@elirobinson/react`, the components that were measuring wrong now carry
the hit area they always appeared to have**, with no change to a single painted
pixel — verified by screenshotting all 84 stories in both themes before and
after:

- `Checkbox`, `Switch` and `RadioGroup` make the row itself the `<label>`
  instead of wrapping one in a `<div>`. The 44px row was already there; a div
  just forwarded nothing. Radio needed it twice over — option text as short as
  "Ash" measured 28x23, so even a full-height text label would not have reached
  44px wide, while the row with the input and gap does.
- `Breadcrumb` links and `RuleLink` get bounded overlays. Both are nav items, so
  the 44px rule applies rather than the dense scale, but padding would have
  spaced out the trail and pushed RuleLink's underline — which is the
  component's whole identity — down the page. The overlays give the same 44x44 a
  finger needs and move nothing, bounded so they cannot reach a neighbour's
  centre.
- The table sort toggle declares `data-touch-target="dense"`. It is grid chrome
  inside a header cell, the same family as the chip remove and the calendar day,
  and its 24px hit area is the WCAG 2.2 AA floor; taking it to 44 would mean a
  44px-tall header row on every table in the system. Declared on the element
  rather than added to `DENSE_AFFORDANCE_SELECTOR`, which is what that list's
  own documentation asks for.

That leaves one finding, deliberately unfixed: `.ds-button--sm` has an 89x36 hit
area. `contracts.json` names buttons as primary controls needing 44x44, and 36px
is exactly shadcn's `size="sm"`, so the variant cannot satisfy the rule and stay
a small button. Exempting it would say buttons are exempt from the button rule.
It is left failing for a deliberate decision rather than settled quietly here.
