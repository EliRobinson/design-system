---
'@elirobinson/ai-patterns': minor
---

`ds-resync artifacts --write` now generates the `design-system-reference` skill and the `miltinson-design` token stylesheets from the `@elirobinson/react` and `@elirobinson/tokens` installed in your repo, not from the snapshot packed with ai-patterns. Upgrading react or tokens no longer leaves the artifacts one release behind, and "Already current" now means "matches what is installed". If either package is missing or too old to read, the bundled snapshot is written and the report says why.
