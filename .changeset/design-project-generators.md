---
'@elirobinson/ai-patterns': patch
---

Generate the Claude Design project's API contract, foundation cards and skill docs.

The design project carried hand-maintained restatements of this repo — an oxlint
config describing the component API, and swatch cards enumerating the token
scale — and both had drifted. The config described a flat prop surface where
`@elirobinson/react` is compound (it put `Sheet`'s `side` on `Sheet` rather than
`SheetContent`, exported a `ToastViewport` that does not exist, and invented
seven child components), and the ink card rendered 10 of the 13 `--ink-*` steps.

Three generators now derive those artifacts from sources that cannot drift —
`@elirobinson/react/manifest` and `tokens.css` — reached through a new
`build:design-project` script. They are internal to this repo: none is added to
the package's `exports`, so nothing new is importable by a consumer.

**What changes for a consumer.** The `miltinson-design` skill written by
`ds-resync artifacts` has one paragraph in a different place. The sentence
naming the tokens stylesheet and the readme is now inside the managed block
rather than below it, because the three surfaces that carry this skill spell
those files differently and the paragraph has to be generated per surface
instead of shared verbatim. The wording and the brand rules are unchanged; only
the block boundary moved. Re-run `ds-resync artifacts` to pick it up — the hash
check will report `SKILL.md` as changed.
