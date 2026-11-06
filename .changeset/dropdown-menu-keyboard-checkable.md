---
'@elirobinson/react': minor
---

`DropdownMenu` gets a keyboard path in, checkable items, and a disabled item style (#273).

- **Keyboard path.** Opening the menu moves focus to the first item that can be chosen (↑ on the trigger opens on the last). ↑ ↓ Home End move between every item role from the focused item, skipping disabled items. Focus returns to the trigger when an item is chosen, on Esc and on Tab (Tab then carries on from the trigger); a click outside leaves focus where it landed. A held Enter or Space no longer chooses the first item on its auto-repeat.
- **`DropdownMenuCheckboxItem`** (`role="menuitemcheckbox"`, `checked`, `onCheckedChange`) and **`DropdownMenuRadioGroup`** (`value`, `onValueChange`) with **`DropdownMenuRadioItem`** (`role="menuitemradio"`, `value`). They share a reserved leading slot for the mark, so labels do not move when it appears. Enter chooses and closes (unless `closeOnSelect={false}`); Space chooses and keeps the menu open. Both are controlled only: the menu unmounts its items when it closes, so state an item kept for itself would reset on every reopen.
- **Disabled items** (`disabled` or `aria-disabled="true"`) use `--fg-disabled`, `cursor: not-allowed` and no hover fill, and an `aria-disabled` item no longer runs its `onClick`.
