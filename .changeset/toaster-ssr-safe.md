---
'@elirobinson/react': patch
---

Fix portal components crashing during server rendering.

`Toaster`, `PopoverContent`, and `DropdownMenuContent` called
`createPortal(…, document.body)` during render, so a Next.js or Remix consumer
hit `ReferenceError: document is not defined` at SSR/build time.

`Toaster` was broken outright — it portals on every render, so merely wrapping
an app in it took the build down, and because `useToast` throws outside the
provider there was no client-only workaround. `Popover` and `DropdownMenu` were
conditional: both return early while closed, so they only crashed when
server-rendered already open via the `open` prop.

All three now gate the portal on a new shared `useHasMounted` hook. The server
pass and the first client render agree (no portal), so hydration stays clean,
and the content attaches on the commit that follows. `Tooltip` already guarded
on its trigger ref and was never affected; it gains regression coverage.
