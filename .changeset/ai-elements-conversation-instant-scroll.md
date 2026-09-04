---
'@elirobinson/ai-elements': patch
---

`Conversation` now scrolls instantly rather than smoothly by default.

It is a `role="log"`, it scrolled itself with an animation on mount and on
every content resize, and nothing in the vendored tree reads
`prefers-reduced-motion`. An instant jump has no motion to reduce. Upstream
spreads `{...props}` last, so `<Conversation initial="smooth" resize="smooth">`
restores the previous behaviour — this changes the default, not the API.
