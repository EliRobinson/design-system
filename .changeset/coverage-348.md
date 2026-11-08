---
'@elirobinson/ai-patterns': patch
---

Fix the `upgrade.md` coverage test, which read 0.32.0's own changeset as a breaking change and turned `main` red (#348). 0.32.0 only adds files. Nothing a consumer installs changes.
