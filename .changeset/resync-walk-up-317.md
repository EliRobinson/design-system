---
'@elirobinson/ai-patterns': patch
---

`ds-resync` now finds an installed package and its migration manifest by walking `node_modules` up from the working directory. Before, only `cwd/node_modules` counted, so a workspace member with a hoisted install disagreed with `ds-resync artifacts`.
