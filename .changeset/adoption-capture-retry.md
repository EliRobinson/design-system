---
'@elirobinson/ai-patterns': patch
---

The visual sweep's settle loop now retries a capture three times when Chromium answers "Unable to capture screenshot", a transient browser error that reddened main on unchanged commits (#299). Other errors still fail at once.
