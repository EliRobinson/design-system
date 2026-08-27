---
'@elirobinson/ai-patterns': patch
---

Collapse the duplicated frame settle in `waitForStablePixels`

Two fixes for the same flake landed independently, so the settle promoted
`loading="lazy"` frames to eager twice and waited for embedded documents to
finish parsing twice. Idempotent, but the same mechanism was described by two
comment blocks that had drifted apart — the second claimed no guard above it
could see embedded documents, which the per-frame loop directly above it does.

One de-lazy pass and one readiness wait now, keeping the stricter
`fonts.status === 'loaded'` condition and the measurements from both
investigations. The `fonts.status` half had shipped without a test; it has one
now, along with tests for the parsing and cross-origin cases.
