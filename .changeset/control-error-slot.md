---
'@elirobinson/react': patch
---

`Input`, `Textarea` and `Select` no longer point `aria-describedby` at the hint's id while an error hides the hint. With both `hint` and `error` set, the control is now described by the error only, as `FormField` already was. Markup is otherwise unchanged.
