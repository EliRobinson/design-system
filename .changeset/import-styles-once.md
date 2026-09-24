---
'@elirobinson/ai-patterns': patch
'@elirobinson/eslint-config': minor
---

Import `@elirobinson/react/styles.css` once, and not `@elirobinson/tokens/tokens.css` as well.

`@elirobinson/react/styles.css` opens with `@import '@elirobinson/tokens/tokens.css'`. The
instructions told apps to import both, which puts two full copies of `tokens.css` in the
bundle. Bundlers keep both, and the later copy wins every equal-specificity tie against the
app's own CSS between them.

**`@elirobinson/ai-patterns`.** Everything it ships now says to import `react/styles.css`
alone, and to import `tokens.css` directly only in an app that does not use
`@elirobinson/react`. That covers the managed `AGENTS.md` block `ds init --agents` writes,
`SKILL.md`, the generated skills and `llms.txt`, `ds patterns`, the `adopt-system` prompt and
the `ds-resync` skill. A Tailwind v4 app still imports `@elirobinson/tokens/tailwind.css`
after it. `ds contracts` gains `token-stylesheet-once`. Run `pnpm ds init --agents` to
refresh the managed block.

**`@elirobinson/eslint-config`.** New rule, on by default in both configs:
`@elirobinson/no-duplicate-token-stylesheet` for JS and TS modules, and
`@elirobinson-css/no-duplicate-token-stylesheet` for stylesheets. It flags an import of
`@elirobinson/tokens/tokens.css` in a file that also imports `@elirobinson/react/styles.css`.
The fix is to delete the `tokens.css` import. It reads one file at a time, so an app that
splits the two imports across files is not caught.
