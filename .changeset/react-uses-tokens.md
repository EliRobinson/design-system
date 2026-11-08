---
'@elirobinson/react': patch
---

Component CSS now reads existing tokens instead of repeating their values: `--target` for 44px hit areas, `--focus-ring-width` and `--focus-ring-offset` for focus rings, `--radius-full` for round shapes. Panel limits are component tokens you can set: `--ds-popover-max-width`, `--ds-sheet-max-width`, `--ds-sheet-max-height`, `--ds-command-palette-list-max-height`, `--ds-table-filter-max-width`. One visible change: the Dialog, Sheet and CommandPalette backdrops use `--scrim`, so they match each other and are darker in dark mode (0.72 instead of 0.5 and 0.45).
