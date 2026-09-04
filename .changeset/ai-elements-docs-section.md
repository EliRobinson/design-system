---
---

Docs site only — no published package changes.

Adds the `/ai-elements` section to the docs site: an overview, install instructions, a
component index generated from `@elirobinson/ai-elements/manifest`, and worked examples.

The one file under `packages/` is `packages/ai-patterns/docs/examples/tool-route.ts`, a
third worked example beside `chat-route.ts` and `decision-route.ts`. `docs/` is not in that
package's `files`, so the tarball is byte-identical and there is nothing for a consumer to
bump to. Hence an empty changeset rather than a patch: the changeset gate keys on package
directories, and a version bump for a file that does not ship would be noise in the
changelog.
