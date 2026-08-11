---
'@elirobinson/ai-patterns': patch
---

Internal: `ds-resync` parses both commands' flags through one table-driven parser instead of two hand-rolled else-if chains, so a flag both commands should honour can no longer land on only one. No change to flag names, defaults, or error messages.
