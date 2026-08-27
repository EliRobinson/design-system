---
'@elirobinson/ai-patterns': patch
---

Regenerated corpus and packed artifacts, for `DecisionCard`'s move to `molecules/`.

No source or API change here. The artifacts under `dist/artifacts/` — `llms.txt`,
`llms-full.txt`, `brand-manifest.json`, and the packed skills — are built from
`@elirobinson/react`'s manifest, so they carried `organisms/DecisionCard` as the import
path an agent should write. They now carry `molecules/DecisionCard`.

This needs its own release rather than riding along silently: an agent reading the shipped
corpus is being handed an import path, and a published corpus that still says
`organisms/DecisionCard` after `@elirobinson/react` v3 hands it one that does not resolve.
