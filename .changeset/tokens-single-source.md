---
'@elirobinson/tokens': minor
'@elirobinson/ai-patterns': patch
---

Make `tokens.css` the only place the token set is written down.

**`@elirobinson/tokens`**

- `tokens.json` is now generated from `tokens.css` at build time. The
  hand-maintained file had drifted to 95 leaf values against 151 `:root` custom
  properties — `--signal-200/300/400/600/800/900` and
  `--anchor-200/300/400/600/800/900` were missing entirely, with nothing marking
  the file as partial. All 151 are now present. The nested shape and every key
  that existed before are unchanged, so `@elirobinson/tokens/tokens-data` and
  `@elirobinson/tokens/tokens.json` keep working; 62 leaves were added.
  Values are now copied verbatim out of the stylesheet, so a few that the
  hand-written file had padded change spelling without changing meaning
  (`oklch(86.0% …)` → `oklch(86% …)`). `--status-success` / `--status-warning`
  now carry the value CSS actually computes (the later, re-pointed declaration).
- New export `@elirobinson/tokens/parse-tokens-css` — the one CSS token parser,
  previously duplicated in three places across the monorepo.
- The package has tests for the first time, including one that fails if
  `tokens.json` stops covering every `:root` custom property.

**`@elirobinson/ai-patterns`**

- The `colors_and_type.css` shipped into `.claude/skills/miltinson-design/` is
  now the tokens package's own `tokens.css` rather than a hand-kept sibling of
  it. The two had diverged: the copy consumers received was missing the `.dark`
  compatibility selector and the dark-mode `--focus-ring` override, so every
  `outline: 2px solid var(--focus-ring)` was black-on-black in dark mode — a
  silent failure of the `focusVisibleRequired` contract.
- `ds tokens` now reports the value CSS resolves to when a token is declared
  twice, and reads only `:root`.
