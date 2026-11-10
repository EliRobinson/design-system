---
'@elirobinson/tokens': patch
---

Reduced-motion clamp now sets `animation-iteration-count: 1`, so infinite loops settle on their final frame instead of strobing. The Spinner pulse stays the one declared opt-out.
