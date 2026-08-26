---
'@elirobinson/tokens': minor
'@elirobinson/react': patch
---

Native form controls inherit the page's font, so a control's own words stop
rendering in the UA's Arial.

`<button>`, `<input>`, `<select>` and `<textarea>` do not inherit `font`. The UA
stylesheet supplies Arial — monospace for `<textarea>` — and five shipped
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
  textarea,
  ::file-selector-button {
    font: inherit;
  }
}
```

**The shorthand and the layer are both load-bearing, and both are measured**
rather than argued — in a browser, in `packages/tokens/src/form-font-cascade.test.mjs`.

**Layered**, for the same reason the bare `a` rule is. Unlayered this rule is
(0,0,1), and unlayered beats every layer regardless of specificity — so it ate a
consumer's `font-mono` (rendered Geist) and, as the shorthand, their `text-2xl`
(rendered 16px, not 24px). That is issue #112 in a new spelling: a bare-element
rule that paints must lose to anything stating an intent. Our own component rules
still win, because `@elirobinson/react` ships them unlayered.

**The shorthand**, because it is what the consumer already has. Tailwind v4's
preflight resets these same elements with `font: inherit`. So this change does
not _introduce_ the rendering below — it **adopts** it, and closes a divergence
that has been shipping: a consumer wired the way `tailwind.css` prescribes has
been seeing one rendering while this repo's own docs, which ship no preflight,
minted baselines from another. Rendered before/after with the real components
and the real stylesheet graph, our "after" page and a "today, with preflight"
page are **byte-identical PNGs** (`18181f93…` light, `bbba09d5…` dark).
`font-family: inherit` alone would have fixed the five faces and left the two
renderings diverged on line-height for good.

The selector list is preflight's, verbatim — including `<textarea>`,
`<optgroup>` and `::file-selector-button`, which are outside the audited five.
Narrowing it to the five would re-open the divergence on precisely those
elements, and both `Textarea` and `Select` are shipped components. Only `font` is
taken from preflight; its colour and background resets are a different change and
are not made here.

**This changes rendered output, and by more than the five controls above.** The
family change affects only them; the shorthand's line-height reset reaches every
native control that never declared one. Measured on the real components at
`--fs-sm`, light theme:

| control                       | face          | box                        |
| ----------------------------- | ------------- | -------------------------- |
| `.ds-search-field__input`     | Arial → Geist | unchanged (44px)           |
| `.ds-pagination__item`        | Arial → Geist | unchanged (44×44)          |
| `.ds-date-picker__day`        | Arial → Geist | unchanged (32px)           |
| `.ds-segmented-control__item` | Arial → Geist | +0.53px wide (text reflow) |
| `.ds-accordion__trigger`      | Arial → Geist | 44 → **47.09px** tall      |
| `.ds-input`                   | already Geist | 44 → **49.09px** tall      |
| `.ds-select`                  | already Geist | 44 → **49.09px** tall      |
| `.ds-textarea`                | already Geist | 64 → **72.19px** tall      |

`.ds-input` is the widest-reaching of these — `Input`, `FormField`, `Combobox`,
`CommandPalette` and the `DatePicker` trigger all wear it — so visual baselines
move across a good deal of the library. Every pixel of that growth is growth a
Tailwind consumer already had; what moves is this repo's own rendering, into
agreement with theirs.

`minor` rather than `patch` because it changes rendered output and layout for
anyone upgrading: on a 0.x package, `minor` is the breaking lane.

**Two checks stop this recurring**, and each was confirmed to fail before it was
trusted green:

- `packages/tokens/src/form-font-cascade.test.mjs` measures the cascade in a real
  browser — the five faces, the two consumer utilities, the component rules'
  own `font-size` and `font-weight` surviving the shorthand, and the
  preflight-parity claim itself. It skips loudly where no Chromium exists.
- `packages/react/scripts/component-css.test.mjs` adds a static section that runs
  everywhere: the reset exists exactly once, sits in `@layer base`, uses the
  shorthand, and **covers every native form element the components actually
  render** — read from the TSX, so a future `<select>`-based component that the
  reset does not name fails the build rather than shipping in Arial.

Two existing tests pinned the old layer contents and are updated deliberately
rather than relaxed: `font-override.test.mjs`'s scope guard now records two
layered rules instead of one, and `control-affordance.test.mjs` now states its
real claim directly — nothing in a layer draws an underline except the bare `a`
rule — instead of inferring it from a one-item roster.

No component API changes. `@elirobinson/react` carries test-only changes.
