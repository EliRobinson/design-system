---
'@elirobinson/react': patch
---

Stepper: a completed step now paints the drawn `check` mark instead of typing `✓`, so the tick no longer depends on a font. The tick is drawn at `--fs-md`, larger than the old `--fs-xs` glyph. Screen readers now hear "Completed" before a completed step's label instead of "check mark". Set the new `completedLabel` prop to change or translate that word.
