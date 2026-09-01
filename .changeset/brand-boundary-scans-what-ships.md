---
'@elirobinson/ai-patterns': patch
---

The brand-boundary check scans everything the packages publish, not two directories.

`brand-boundary.test.mjs` opened by asserting that no published artifact carries a brand
term outside a permitted file, and scanned `dist/artifacts` plus the agent templates. Both
`@elirobinson/ai-patterns` and `@elirobinson/tokens` list `src` in `files`, so most of
published source was never looked at — which is how a banner naming one consumer survived
the run that caught three others (#214, #213).

The file set is now derived from each package's own `files` field, negations included, so
the exclusions are the manifest's rather than a second list that can drift from it. A
`files` entry that resolves to nothing throws instead of silently shrinking the scan.

Two shipped comments in this package used the company name as their worked example —
`src/artifacts/llms.mjs` explaining what the `llms.txt` intro stopped saying, and
`src/voice/schema.mjs` explaining why a pack carries a short mark and a legal name as
separate fields. Both now use a placeholder, which carries the lesson without shipping the
string. The reasoning is recorded in `docs/agents/brand-boundary.md`, along with why the
published changelogs are permitted rather than rewritten.
