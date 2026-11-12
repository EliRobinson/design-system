---
'@elirobinson/react': patch
---

Component descriptions in `@elirobinson/react/manifest` no longer list variant values or count them. Avatar, Badge, Button, Spinner, Alert and Separator had prose copies of their variant unions, which went stale when a value was added; Card and EmptyState listed their parts and props the same way. The values stay in each component's `variants`, `props` and `subComponents`. Rating's description is reworded so it no longer reads as a variant name. A test now fails if a description, or a sub-component's, names its own variant values, lists variant values from any component, or counts them.
