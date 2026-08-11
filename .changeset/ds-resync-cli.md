---
'@elirobinson/ai-patterns': minor
'@elirobinson/react': patch
'@elirobinson/tokens': patch
---

Add `ds-resync`, a command for bringing a consuming repo's `@elirobinson/*` packages up to
date. A bare run reports current versus latest per package along with the changelog entries
in between; `--write` rewrites the ranges and installs.

`@elirobinson/react` and `@elirobinson/tokens` now ship `CHANGELOG.md` in their published
tarballs, which is what makes the migration notes readable from a consuming repo.
