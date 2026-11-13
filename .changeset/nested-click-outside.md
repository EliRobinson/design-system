---
'@elirobinson/react': patch
---

A click inside a Popover, DropdownMenu or Dialog that was opened from another Popover or DropdownMenu no longer closes the outer one. Click outside now uses the same layer tree as Escape, so a click inside any nested layer counts as inside its parent, even when that layer is portalled.

If you call the hooks yourself: `useEscapeKey` and `useNativeEscapeLayer` take a list of the nodes the layer draws as a new last argument, and `useClickOutside` accepts that layer in place of a list of refs. A new `isInsideLayer` export does the same check. Existing calls work as before.
