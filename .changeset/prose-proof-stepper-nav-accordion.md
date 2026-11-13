---
'@elirobinson/react': patch
---

Stepper, NavigationMenu and Accordion keep their own type and list styles inside a host `.prose`. The Stepper `ol` and its steps, the NavigationMenu lists and items, and the Accordion heading now reset at (0,2,0), as #383 did for Card, Pagination and others. The Accordion heading now inherits its font size, weight and colour; its trigger sets its own, so nothing on screen changes. A consumer that restyled one of these with a single class (for example `.ds-stepper` or `.ds-navigation-menu__list`) now needs the root too (`.ds-stepper.ds-stepper`, `.ds-navigation-menu .ds-navigation-menu__list`).
