---
'@elirobinson/ai-patterns': patch
---

The Claude skill and Copilot instructions written by `init --agents`, and the dark mode note in `patterns.md`, no longer say the `next-themes` default `class` strategy leaves dark mode doing nothing. `.dark` has been a working alias for `[data-theme="dark"]` since `@elirobinson/tokens@0.3.0`. The advice to set `attribute="data-theme"` stays. Re-run `init --agents --force` to refresh files written by an earlier version.
