---
'@elirobinson/ai-elements': patch
---

The `./fixtures` subpath is now documented, including what about it is stable.

It was published with no mention in the README, and the manifest cannot reach it —
`generate-manifest.mjs` walks `components/`, `ui/` and `lib/` only — so "read the manifest"
found nothing. The README now names the subpath, its two exports, the second `@source`
Tailwind needs for `dist/fixtures`, and the semver line: the subpath and the key shape are
API, a fixture's internal composition and a variant label are not.

The provenance section no longer claims `NOTICE` is generated. It is not; a check in the
source repository holds it against the transform layer's rule ids instead.
