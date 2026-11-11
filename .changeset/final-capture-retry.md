---
'@elirobinson/ai-patterns': patch
---

The visual sweeps retry the final screenshot comparison once when Chromium answers "Unable to capture screenshot". A pixel mismatch is never retried.
