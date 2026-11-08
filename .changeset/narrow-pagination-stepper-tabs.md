---
'@elirobinson/react': minor
---

Pagination, Stepper and Tabs now fit a 320px screen (#345).

- `Pagination` shows at most seven page slots: past seven pages it keeps the first, the last and the current page with its neighbours, and draws a gap for the rest. When the row is wider than the nav, it shows Previous, "Page X of Y" and Next. An out-of-range `page` now marks the page it is kept to as current.
- `Stepper` stacks its steps, one per line, on a screen narrower than 30rem.
- `TabsList` scrolls sideways inside itself when the tabs do not fit, and scrolls the active tab into view. The focus ring now sits inside the tab, so the scroll edge does not clip it.

No layout changes for wide screens, and nothing to change in your own CSS.
