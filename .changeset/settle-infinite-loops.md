---
'@elirobinson/tokens': patch
---

The reduced-motion clamp now sets `animation-iteration-count: 1`, so infinite loops play once and rest on the element's own style instead of strobing. Components that need motion, such as the Spinner pulse, opt out.
