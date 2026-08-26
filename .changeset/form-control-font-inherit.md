---
'@elirobinson/tokens': minor
'@elirobinson/react': patch
---

Native form controls inherit the page's typeface, so a control's own words stop
rendering in the UA's Arial.

`<button>`, `<input>`, `<select>` and `<textarea>` do not inherit `font-family`.
The UA stylesheet supplies Arial — monospace for `<textarea>` — and five shipped
controls set `font-size` and nothing else, so each typeset **real words** in a
different face from the label beside it:

| control                       | what rendered in Arial      |
| ----------------------------- | --------------------------- |
| `.ds-search-field__input`     | **the text the user types** |
| `.ds-pagination__item`        | page numbers                |
| `.ds-segmented-control__item` | segment labels              |
| `.ds-accordion__trigger`      | the trigger's own label     |
| `.ds-date-picker__day`        | day numbers                 |

One rule in `tokens.css` fixes all five:

```css
@layer base {
  button,
  input,
  optgroup,
  select,
  textarea {
    font-family: inherit;
  }
  ::file-selector-button {
    font-family: inherit;
  }
}
```

**Rendered output changes by one typeface and, measured on the real components,
essentially nothing else.** The only box that moves is
`.ds-segmented-control__item`, 0.53px wider, because Geist sets its label
slightly differently from Arial. `.ds-input`, `.ds-textarea`, `.ds-select`,
`.ds-search-field__input`, `.ds-pagination__item` and `.ds-date-picker__day` are
unchanged in both axes.

**Layered**, for the same reason the bare `a` rule is. Unlayered this rule is
(0,0,1), and unlayered beats every layer regardless of specificity — so it ate a
consumer's `font-mono` and rendered their button in Geist with no stylesheet of
their own able to say otherwise. That is issue #112 in a new spelling: a
bare-element rule that paints must lose to anything stating an intent. Our own
component rules still win, because `@elirobinson/react` ships them unlayered.

**`font-family`, not the `font` shorthand, and that is a deliberate departure
from Tailwind's preflight.** The shorthand also resets `line-height`, which none
of these controls declares, so it reaches every native control in the system
rather than the five with the wrong face — measured on the real components:
`.ds-input` and `.ds-select` 44 → 49.09px, `.ds-textarea` 64 → 72.19px,
`.ds-accordion__trigger` 44 → 47.09px. The face is the reported bug; the
line-height is a layout change across most of the library that nobody asked for.

**What that costs, stated plainly:** preflight resets these elements with the
shorthand, so a consumer wired the way `tailwind.css` prescribes renders these
controls with the inherited line-height while this repo's own docs — which ship
no preflight — do not. That divergence is real, it predates this rule, and this
rule does not close it. It is accepted knowingly, and
`form-font-cascade.test.mjs` measures exactly where the two still differ so it
is recorded rather than forgotten: for a control that states its own font-size —
which every audited one does — the difference is exactly one property deep, same
face, same size, same weight, different line-height. For a control that states
nothing, the shorthand resets size and weight too, so a consumer's bare
`<textarea>` renders at the UA's 13.33px under our rule and the inherited 16px
under preflight.

`::file-selector-button` is a **rule of its own**, not a sixth entry in the
element list, and it has to stay that way. An unrecognised selector invalidates
the _entire_ rule it appears in — measured in Chromium: one bogus pseudo-element
added to a `button, input, …` list sent the button back to the UA's Arial while
`body` was Georgia. Written as one list, this fix would be silently conditional
on the engine knowing that one pseudo-element, and would take all five audited
controls down with it with no error anywhere — the same silent-total shape as the
`fonts.css` `@import` bug. Preflight ships it in one list because a build step
compiles it against declared targets; this package hands raw CSS to whatever
engine a consumer has. The split costs two rules and changes nothing else.

The selector coverage is preflight's — `<textarea>`, `<optgroup>` and
`::file-selector-button` included, though none is among the audited five —
because "which elements fail to inherit" has one answer and it is not the subset
that happened to have a bug filed. `Textarea` and `Select` are shipped
components.

`minor` rather than `patch` because it changes rendered output for anyone
upgrading: on a 0.x package, `minor` is the breaking lane.

**Two checks stop this recurring**, and each was confirmed to fail before it was
trusted green:

- `packages/tokens/src/form-font-cascade.test.mjs` measures the cascade in a real
  browser — the five faces, the consumer utility that decides the layer, the
  component rules' own `font-size` and `font-weight`, the bounded box movement,
  and the preflight divergence itself. It skips loudly where no Chromium exists.
- `packages/react/scripts/component-css.test.mjs` adds a static section that runs
  everywhere: the reset is exactly two rules, sits in `@layer base`, uses the
  longhand, keeps the element list free of pseudo-elements, and **covers every
  native form element the components actually render** — read from the TSX, so a
  future `<select>`-based component the reset does not name fails the build
  rather than shipping in Arial.

A regression to the shorthand now fails in both, which is the point: matching
preflight is a reasonable-looking edit, and it is one that should be argued
rather than merged quietly.

Two existing tests pinned the old layer contents and are updated deliberately
rather than relaxed: `font-override.test.mjs`'s scope guard now records two
layered rules instead of one, and `control-affordance.test.mjs` now states its
real claim directly — nothing in a layer draws an underline except the bare `a`
rule — instead of inferring it from a one-item roster.

No component API changes. `@elirobinson/react` carries test-only changes.
