---
'@elirobinson/tokens': patch
'@elirobinson/ai-patterns': patch
---

Self-host Geist and JetBrains Mono. `tokens.css` no longer reaches Google Fonts through a render-blocking remote `@import` — it `@import`s a package-local `fonts.css` that declares `@font-face` over woff2 files shipped in the package (both families are SIL OFL 1.1; licenses included). Importing `@elirobinson/tokens/tokens.css` is enough: bundlers inline the import and emit the font assets, a plain `<link>` resolves it relatively, and no request leaves the consumer's origin. Consumers that stripped the remote import and self-hosted via `@fontsource-variable/*` (plus `--ds-font-*-override` pointing at those families) can delete that wiring. The `@elirobinson/ai-patterns` brand skill ships the same faces alongside `colors_and_type.css`, so its `@import './fonts.css'` resolves in a consumer's `.claude/skills/` too.
