---
'@elirobinson/react': patch
---

Dialog, Sheet and CommandPalette titles and descriptions, and the CommandPalette and Combobox lists, keep their own styles inside a host `.prose` (Tailwind Typography or any typographic reset). Their resets are now scoped under the component root at (0,2,0), so to override them, match that specificity (for example `.ds-dialog .my-title`). The Dialog and Sheet title now set `line-height: var(--lh-snug)` instead of inheriting the page's. The CommandPalette lists no longer show the browser's default bullets, indent and margins anywhere, and the Combobox empty state sets its own margin and line-height. The Combobox list now opens below its input when the root is a flex container.
