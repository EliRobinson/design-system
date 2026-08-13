---
'@elirobinson/ai-patterns': minor
---

Add `@elirobinson/ai-patterns/brand-manifest`: one record per artifact in `design-system-docs/`, with category, origin (generated cards are identified by importing `buildGuidelineCards`, never a hardcoded list), ships/shipReason derived from `BRAND_SOURCES`, per-artifact render facts (dependencies as written, external origins through the stylesheet chain, viewports), and member roles. The in-repo `design-system-docs/README.md` index table is now generated from it between the managed markers — fixing the phantom `templates/` row, the fifth slide template that never existed, and the auth surface the webapp kit does not export, and adding the six top-level entries the hand-kept table omitted.
