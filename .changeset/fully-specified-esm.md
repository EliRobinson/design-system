---
'@elirobinson/react': patch
---

Emit fully-specified relative ESM specifiers in dist (`./utils.js`, not `./utils`). tsc now compiles with `module: NodeNext`, so the built files load under Node's own resolver — a Vite SSR dev server no longer throws `ERR_MODULE_NOT_FOUND` on every component, and the `ssr.noExternal: ['@elirobinson/react']` workaround can be dropped. Every build now ends by importing all of dist with plain `node` (`scripts/smoke-dist.mjs`), so an extensionless specifier can't ship again.
