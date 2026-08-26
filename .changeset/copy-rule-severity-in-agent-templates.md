---
'@elirobinson/ai-patterns': patch
'@elirobinson/eslint-config': patch
---

Stop the agent templates stating the copy rule's severity as a fact, and document
`designSystem()`'s options where a consumer can reach them.

`no-padded-ui-copy` ships at `warn`, and three of the four templates `ds init --agents`
writes said so flatly — "`@elirobinson/eslint-config` warns on the literal phrases". For a
repo that has taken the documented graduation step, `designSystem({ copy: { severity:
'error' } })`, that sentence is false, and it is not the consumer's to fix: the `AGENTS.md`
copy lives inside the `design-system:begin/end` markers and the other three are whole-file
writes, so `--force` discards any correction. All four now describe what the rule _reports_,
name `warn` as the shipped default rather than as the effective level, and carry the raise —
which also puts the graduation step on four surfaces instead of one.

`patch` on `@elirobinson/ai-patterns`: `src/agents/*` and `src/patterns.md` are published
files behind the `./agents/*` and `./patterns` exports, so `ds init --agents --force` and
`pnpm ds patterns` print different text after this.

`patch` on `@elirobinson/eslint-config`: the package had no README, so the option surface —
including that `copy.severity` is destructured separately from the top-level `severity` and
therefore does not inherit it — existed only as JSDoc a consumer reads by opening
`node_modules`. The new README ships in the tarball and is what the registry page renders.
No rule, option, or default changed.
