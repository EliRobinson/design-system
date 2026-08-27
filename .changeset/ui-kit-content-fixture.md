---
'@elirobinson/ai-patterns': patch
---

The shipped UI kits keep their structure and hand their strings to one file.

The four kits — marketing, webapp, mobile, docs — are useful surface archetypes and that
taxonomy is the system's. The 41 Miltinson strings spread across 13 of their files were
not: a reskin meant 41 edits, and a re-crossing of the boundary was invisible.

Everything a consumer would have to rewrite now lives in `ui_kits/_shared/content.js`.
Three components are renamed for the same reason: `CoachingBand` → `FeatureBand`,
`RecipesScreen` → `BrowseScreen`, `MathsScreen` → `PracticeScreen`.
