---
'@elirobinson/react': minor
---

`Checkbox` and `Switch` take an `error` prop, matching `Input`'s. It sets `aria-invalid`, adds the error's id to `aria-describedby` after any id the caller passes, renders the message under the row as `<span class="ds-hint ds-hint--error" role="alert">`, and outlines the control in `--status-danger` (`ds-checkbox--error` / `ds-switch--error` on the row). Without `error` the markup is unchanged, and an error appearing does not remount the input.
