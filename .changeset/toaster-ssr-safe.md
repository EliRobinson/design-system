---
'@elirobinson/react': patch
---

Fix `Toaster` crashing during server rendering.

`Toaster` called `createPortal(…, document.body)` unconditionally in its render
body, so any Next.js or Remix consumer that wrapped their app in it hit
`ReferenceError: document is not defined` at build/SSR time. Because `useToast`
throws outside the provider, mounting it client-only was not a viable
workaround.

The portal is now gated behind a mount flag: the server and the first client
render both emit no viewport, then the viewport attaches after hydration.
Toasts are interaction-driven, so nothing is lost from the server pass.
