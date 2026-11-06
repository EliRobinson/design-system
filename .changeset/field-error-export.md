---
'@elirobinson/react': minor
---

Add `FieldError` at `@elirobinson/react/components/atoms/FieldError`: the error message of a field with no control of its own, such as a list or a group. It renders the same `<span class="ds-hint ds-hint--error" role="alert">` that `Input`, `Textarea`, `Select`, `Checkbox` and `Switch` render for their `error`, takes an optional `id` for `aria-describedby`, and renders nothing without children.
