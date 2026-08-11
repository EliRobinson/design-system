---
'@elirobinson/react': patch
---

Extract the overlay primitives the organisms were duplicating, and fix a duplicate-id accessibility bug that fell out of the copy.

- New `useDisclosure` hook (`@elirobinson/react/hooks/useDisclosure`) owns the controlled/uncontrolled open-state pattern that `Dialog`, `Sheet`, `Popover`, and `DropdownMenu` each carried their own copy of.
- `Dialog` and `Sheet` now build on one shared modal surface, and `Popover` and `DropdownMenu` on one shared anchored overlay.
- **Accessibility fix:** `Dialog` and `Sheet` minted their title and description ids from the constants `ds-dialog-title` / `ds-sheet-title`. Two dialogs on one page emitted duplicate DOM ids, and every `aria-labelledby` resolved to whichever rendered first, so the second dialog announced the first one's title. Both now use `useId()`.
- `Tooltip` uses the shared `useAnchoredPosition` hook instead of measuring its trigger during render, so it repositions on scroll and resize. `useAnchoredPosition` gained optional `align` and `zIndex` options and now keeps every anchored panel in place through scroll and resize.
- `useClickOutside` and `useEscapeKey` no longer re-attach their document listeners on every render.

No public API changes: every exported name, prop, and CSS class name is unchanged.
