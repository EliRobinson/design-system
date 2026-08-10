---
---

No release: design-sync tooling only.

`packages/react/index.d.ts` is a generated, types-only export surface that the
claude.ai/design converter reads to discover the component roster. It is
excluded from the published tarball by `files: ["dist","src"]` — verified with
`npm pack --dry-run` (332 files = 208 dist + 123 src + package.json, unchanged
from before this branch). No shipped code, types, or package metadata changed,
so `@elirobinson/react` does not need a version bump.
