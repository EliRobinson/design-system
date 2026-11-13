---
'@elirobinson/react': patch
---

Stepper, NavigationMenu and Accordion keep their own type and list styles inside a host `.prose`. The Stepper `ol` and its steps, the NavigationMenu lists and items, and the Accordion heading now reset at (0,2,0), as #383 did for Card, Pagination and others. The Accordion heading now inherits its font family, size, weight and colour, so a host heading face no longer reaches the trigger; in a bare render nothing on screen changes. Only the reset properties moved to (0,2,0): list style, margin, padding, line-height and letter-spacing on the Stepper list and steps, and the NavigationMenu lists and items. A consumer that overrode one of those with a single class now needs (0,2,0) too (`.ds-stepper.ds-stepper`, `.ds-stepper .ds-stepper__step`, `.ds-navigation-menu .ds-navigation-menu__list`). Layout and type stay at one class.
