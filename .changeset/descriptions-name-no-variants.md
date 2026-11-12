---
'@elirobinson/react': patch
---

Component descriptions in `@elirobinson/react/manifest` no longer list variant values or count them. Avatar, Badge, Button, Spinner, Alert, Separator and Rating had prose copies of their variant unions, which went stale when a value was added. The values stay in each component's `variants` and prop types. A test now fails if a description names a variant value or counts variants.
