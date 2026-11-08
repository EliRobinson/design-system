---
'@elirobinson/react': patch
---

Spinner: under `prefers-reduced-motion: reduce`, the ring stops spinning and pulses its opacity slowly instead. Before, the global reduced-motion clamp squeezed each turn into 0.01ms, so the ring looked frozen with jumps and loading read as stuck (#332).
