---
'@elirobinson/react': minor
---

Forward refs through `DialogTrigger`, `DialogClose`, `SheetTrigger` and
`SheetClose`, and widen their props to `ButtonHTMLAttributes`.

All four render a `<button>` but were plain function components, which the
`forward-ref` contract has always disallowed:

> Every component that renders a focusable or interactive native element uses
> `forwardRef`, forwarding to the outermost interactive element the component
> owns.

They all delegate to the shared `ModalTrigger` / `ModalClose` parts, so the fix
is one `forwardRef` in the shared parts plus forwarding through the four public
wrappers. The refs resolve to the `<button>` node itself. These parts own their
button outright and hold no second reference to it, so they forward the ref
directly rather than merging it the way `ModalSurface` has to.

**On React 19 the runtime half of this already worked by accident.** `ref` is an
ordinary prop for function components there, so it rode the `{...props}` spread
down to the `<button>`. The defect that bit consumers was at the type level: the
props were `HTMLAttributes<HTMLButtonElement>`, which carries no `ref` and no
button attributes, so `<DialogTrigger ref={...}>` and `<DialogClose disabled>`
were both type errors on components that would have honoured them at runtime.

**Props widening.** The four props types are now
`ButtonHTMLAttributes<HTMLButtonElement>`, matching `DropdownMenuTriggerProps`
and `DropdownMenuItemProps`. This adds `disabled`, `type`, `form`, `name` and
`value`, and is additive — every currently valid usage still compiles.

`type="button"` stays a default rather than a pin: it precedes the prop spread,
so a consumer-supplied `type` wins. That matches `DropdownMenuItem`,
`ToastAction` and `AnchoredOverlayTrigger`, and it keeps a close button that
also submits an enclosing form expressible. Accepting `type` in the props type
and then silently discarding it would be the worse option — a prop the types
advertise and the component ignores.
