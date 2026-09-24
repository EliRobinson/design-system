---
'@elirobinson/ai-patterns': minor
'@elirobinson/eslint-config': minor
---

Import `@elirobinson/react/styles.css` once, and not `@elirobinson/tokens/tokens.css` as well.

`@elirobinson/react/styles.css` opens with `@import '@elirobinson/tokens/tokens.css'`. The
instructions told apps to import both, which puts two full copies of `tokens.css` in the
bundle. Bundlers keep both, and the later copy wins every equal-specificity tie against the
app's own CSS between them.

**`@elirobinson/ai-patterns`.** Everything it ships now says to import `react/styles.css`
alone. An app that does not import `styles.css` (no React, or only per-component sheets,
which do not bring the tokens) imports `tokens.css` itself. That covers the managed
`AGENTS.md` block `ds init --agents` writes, `SKILL.md`, the Cursor and Copilot rule files,
the generated skills and `llms.txt`, `ds patterns`, the `adopt-system` prompt and the
`ds-resync` skill. A Tailwind v4 app puts the import in its CSS entry after
`@import 'tailwindcss'` and still imports `@elirobinson/tokens/tailwind.css` after it.
`ds contracts` gains `token-stylesheet-once`. Run `pnpm ds init --agents` to refresh the
managed block and the skill.

**`@elirobinson/eslint-config`.** New rule, on by default in both configs at **`warn`**,
whatever `severity` says, like `no-padded-ui-copy`: an app that followed the old
instructions imports both files, and a rule that red-builds it on upgrade gets switched off.
`@elirobinson/no-duplicate-token-stylesheet` covers JS and TS modules, and
`@elirobinson-css/no-duplicate-token-stylesheet` covers stylesheets. It flags an import of
`@elirobinson/tokens/tokens.css` in a file that also imports `@elirobinson/react/styles.css`,
and a second import of either one in the same file. The fix is to delete the `tokens.css`
import; then raise the rule to `'error'` in your own config. It reads one file at a time and
static imports only, so an app that splits the imports across files is not caught.
