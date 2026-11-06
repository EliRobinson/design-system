---
'@elirobinson/react': minor
---

`Tooltip` takes a `side` prop (`top`, `bottom`, `left`, `right`; default `bottom`) and flips to the opposite side when there is no room. Escape now dismisses it, and hover and focus no longer share one state, so the pointer leaving does not hide a tooltip that keyboard focus still holds. A new `labelOnly` prop is for tooltips that only repeat the trigger's own name: the trigger gets no `aria-describedby` and the content is `aria-hidden`. `useAnchoredPosition` accepts `left` and `right` too; `top` and `bottom` behave as before.
