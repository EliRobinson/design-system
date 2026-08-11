---
'@elirobinson/ai-patterns': minor
---

Ship the `elirobinson-ds` discovery CLI as a `bin`, so agents and humans ask the installed
packages what exists instead of trusting a doc.

Consumers reduce to one package.json line — `"ds": "elirobinson-ds"` — and get `ds`,
`ds props <Name>`, `ds tokens [filter]`, `ds classes [filter]`, `ds contracts`,
`ds patterns`, `ds prompts [name]` and `ds init --agents`. Discovery walks the installed
package tree rather than assuming a directory structure, so the same command describes a
flat 0.x layout and a tiered 1.x one; it reads `@elirobinson/react`'s new `manifest.json`
and falls back to parsing emitted declarations on older installs. A missing package
produces an instruction naming what to install.
