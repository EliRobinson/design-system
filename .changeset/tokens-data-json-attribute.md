---
'@elirobinson/tokens': patch
---

`@elirobinson/tokens/tokens-data` now loads under plain Node ESM. It imported `tokens.json` without `with { type: 'json' }`, so Node threw `ERR_IMPORT_ATTRIBUTE_MISSING` in any runtime that loads the package without a bundler, such as a Vitest suite that keeps dependencies external. Bundled apps were not affected. Found by the new packed-package consumer check (#327).
