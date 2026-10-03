---
'@elirobinson/react': minor
---

`Checkbox` and `Switch` take an `error` prop, matching `Input`'s. It sets `aria-invalid`, adds the error's id to `aria-describedby` after any id the caller passes, renders the message as `<span class="ds-hint ds-hint--error" role="alert">` after the row, and outlines the control in `--status-danger` (`ds-checkbox--error` / `ds-switch--error` on the row). Without `error` the markup is unchanged, and an error appearing does not remount the input. The message is a sibling of the row, not wrapped, so a flex or grid parent lays it out as its own item.

An app importing per-component sheets needs `@elirobinson/react/styles/atoms/field.css` beside `Checkbox.css` / `Switch.css` for the message styles; the manifest now lists it for both.
