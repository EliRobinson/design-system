---
'@elirobinson/react': minor
---

Pagination, Stepper and Tabs now fit a 320px screen (#345).

- `Pagination` shows at most seven page slots: past seven pages it keeps the first, the last and the current page with its neighbours, and draws a gap for the rest. When the row does not fit, it shows Previous, "Page X of Y" and Next. The nav is a size container and now fills its parent's width; set `justify-content` on it to move the buttons to one side.
- `Stepper` stacks its steps, one per line, when it is narrower than 30rem. The list is a size container and fills its parent's width.
- `TabsList` scrolls sideways inside itself when the tabs do not fit, and scrolls the active tab into view. The focus ring now sits inside the tab, so the scroll edge does not clip it.
