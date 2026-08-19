---
'@elirobinson/ai-patterns': patch
---

Ship UI kit samples that lint clean in a consuming repo.

`ds-resync artifacts --write` writes the kits into `.claude/skills/`, a
directory most projects lint, where they produced 21 errors: 16
`react/jsx-no-undef` for the five components `_shared/Primitives.jsx` defines,
and 5 `no-undef` for `window`.

The samples were not wrong — they load as classic `<script type="text/babel">`
tags sharing one global scope, so there is nothing to import. They now say so,
in the file, with a scoped `eslint-disable` for the one rule and a truthful
`/* global window */`. Everything else about them is still linted, and only the
kits that actually reference the shared primitives carry the disable, so
`reportUnusedDisableDirectives` stays quiet.
