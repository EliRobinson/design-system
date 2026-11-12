---
'@elirobinson/react': minor
---

The manifest's hook records gain `usedBy`: the components and hooks that use each hook, read off the import graph of `src/`. An internal helper between them, such as an overlay module, is looked through to the components that import it. The docs site's hooks page now takes its "Used by" lines from this field instead of a hand-kept list.
