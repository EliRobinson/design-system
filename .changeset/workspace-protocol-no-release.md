---
---

No release: internal dependency declarations only.

`@elirobinson/react` now declares `@elirobinson/tokens` as `workspace:*` instead
of the exact version `0.3.0`. pnpm rewrites the protocol to a real version at
pack time, so the published tarball is unchanged — verified with `pnpm pack`,
which still emits `"@elirobinson/tokens": "0.3.0"`. Nothing a consumer receives
changed, so `@elirobinson/react` does not need a version bump.
