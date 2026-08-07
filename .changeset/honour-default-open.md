---
'@elirobinson/react': patch
---

Fix `defaultOpen` being silently ignored on all four overlay components.

`Dialog`, `Sheet`, `Popover`, and `DropdownMenu` each declared
`defaultOpen?: boolean` in their props type, but none of them destructured it —
every one hardcoded `useState(false)`. The prop typechecked, so consumers had
no signal it did nothing; `<Dialog defaultOpen>` simply rendered closed.

All four now seed their uncontrolled state from `defaultOpen`. A controlled
`open` prop still wins, so `defaultOpen` only applies when `open` is omitted.

Note for `Popover` and `DropdownMenu`: now that `defaultOpen` works, it reaches
the same portal that `open` does, so a server-rendered `defaultOpen` overlay
relies on the mount gate added alongside it — its content appears one commit
after hydration rather than in the server markup.
