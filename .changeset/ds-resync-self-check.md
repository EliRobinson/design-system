---
'@elirobinson/ai-patterns': patch
---

`ds-resync` now checks its own version against the registry and warns loudly when the running copy is behind the latest release, instead of trusting the version it was built at.

`pnpm dlx`/`npx` can hit a registry auth error while resolving what to run and silently fall back to whatever build is sitting in the dlx cache instead of failing (#211). That left `ds-resync artifacts` and the default version-sync command reporting against an old cached binary with no indication anything was wrong. The check runs before both commands and is best-effort — a registry problem checking itself is swallowed, since it should never be the reason an otherwise-offline-capable command stops working.
