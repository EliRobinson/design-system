---
'@elirobinson/ai-patterns': patch
---

`ds-resync` and `elirobinson-ds` now find the lockfile by walking up, as installs do, so a workspace member with a root lockfile reports its locked version. Drift counts only when the install sits under the lockfile's directory, which removes a false warning from an ancestor's install. The package lookup moved to one shared module.
