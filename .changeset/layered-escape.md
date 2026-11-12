---
'@elirobinson/react': minor
---

Escape now closes only the topmost layer. Tooltip, Popover, DropdownMenu, Dialog and Sheet share one dismissal stack, so a tooltip inside a popover inside a dialog closes one layer per keypress instead of all three at once. An Escape keydown that something inside the layer already cancelled (for example a Combobox closing its listbox) is left alone. Escape from inside a Popover now returns focus to its trigger, as DropdownMenu already did. A consumer `onKeyDown` that cancels Escape inside a Popover or DropdownMenu now keeps it open; before, it closed anyway. If you call `useEscapeKey` yourself, your callback now joins the same stack: it runs only while it is the topmost layer and nothing has cancelled the keydown, and it cancels the keydown when it runs. It returns an `EscapeLayer` to pass to the new `EscapeLayerProvider` around anything that opens inside it. `useNativeEscapeLayer` is new, for a layer the browser dismisses itself.
