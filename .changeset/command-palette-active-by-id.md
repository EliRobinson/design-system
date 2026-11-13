---
'@elirobinson/react': minor
---

`CommandPalette`: the highlighted row now follows the command's `id`, not its position. When async results change the rows above it, `Enter` still runs the command the user highlighted; the highlight goes to the first row only when that command is gone. Each command can also set `filter: false` to always show while the other rows keep the built-in label filter. `useActiveDescendant` takes an optional `keys` list and returns `resetActive`; `Combobox` is unchanged.
