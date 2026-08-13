---
'@elirobinson/ai-patterns': minor
'@elirobinson/eslint-config': minor
---

Two additive surfaces for the MCP server: `@elirobinson/ai-patterns` exports `./adherence` (the generated adherence-config builder) and `./brand-readme` (the packed brand README the voice rules are extracted from), and `@elirobinson/eslint-config` exports `mcpStdio(files)` — a flat-config block for packages that serve MCP over stdio, where a single `console.log` corrupts the JSON-RPC channel: `no-console` at error severity, `console.error` only.
