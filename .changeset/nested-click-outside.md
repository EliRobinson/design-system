---
'@elirobinson/react': patch
---

A click inside a Popover, DropdownMenu or Dialog that was opened from another Popover or DropdownMenu no longer closes the outer one. Click outside now uses the same layer tree as Escape, so a click inside any nested layer counts as inside its parent, even when that layer is portalled.
