---
---

No release: tooling and a test. `scripts/sync-workspace-deps.mjs` is not published, and the
test this adds to `@elirobinson/ai-patterns` is excluded from the package by
`"!src/**/*.test.mjs"`, so no published file changes. The one content edit —
`templates/default-app/package.json` — belongs to the private
`create-elirobinson-design-system` scaffolder, which `.changeset/config.json` already
ignores.
