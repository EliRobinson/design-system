---
'@elirobinson/react': minor
---

`RadioGroup` and `Slider` take an `error` prop, matching `Input`'s. On `RadioGroup` it sets `aria-invalid` and adds the error's id to `aria-describedby` on the `role="radiogroup"` element, not on each item, and outlines the radios in `--status-danger` (`ds-radio-group--error`). On `Slider` it sets both on the range input and adds `ds-slider__input--error`. The message renders after the control as `<span class="ds-hint ds-hint--error" role="alert">`. Without `error` the markup is unchanged.
