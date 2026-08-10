---
'@elirobinson/ai-patterns': minor
---

`ds-resync` can now upgrade a subset of packages, each to a chosen distance. `--only`
restricts the run to named packages, `--target` picks how far to jump (`latest`, `minor`,
or `patch`, globally or per package), and `-i` walks the choices interactively.

This exists for the case that actually blocks an upgrade: a breaking major you are not
ready for should not cost you the fixes below it. The report names any version held back
so the deferred migration stays visible.
