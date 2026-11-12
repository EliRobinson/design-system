---
'@elirobinson/react': patch
---

Escape now closes only the topmost layer. Tooltip, Popover, DropdownMenu, Dialog and Sheet share one dismissal stack, so a tooltip inside a popover inside a dialog closes one layer per keypress instead of all three at once. An Escape keydown that something inside the layer already cancelled (for example a Combobox closing its listbox) is left alone. Escape from inside a Popover now returns focus to its trigger, as DropdownMenu already did.
