---
'@elirobinson/react': minor
---

`FormField`: the error message now renders with `role="alert"`, matching `Input`, so a
message that appears after focus has left the control (validate-on-blur) is announced.
It keeps its `aria-describedby` link and its classes. A hint that turns into an error
now mounts a fresh element rather than reusing the hint's, so the announcement is not
lost.

New `labelAside?: ReactNode` prop renders after the label on the same row (a badge, a
small action button). It sits outside the `<label>`, so the control's accessible name and
`htmlFor` association are unchanged. Without it, the markup is unchanged.
