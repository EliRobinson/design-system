---
'@elirobinson/tokens': minor
'@elirobinson/ai-patterns': minor
'@elirobinson/eslint-config': minor
---

Ship the token migrations as a manifest and a command, instead of as prose.

The palette release changes `--status-success` and `--status-warning`, makes
`--fg-inverse` wrong on a status fill, requires a warning edge to be
`--status-warning-border`, and demotes `--fg-on-signal` to a legacy alias. Until
now the entire migration surface for that was the changelog: `ds-resync` printed
the entries, and step 4 of its skill told an agent to "fix the call sites the
breaking entries described". Every consuming repo re-derived the same find and
replace by hand, from prose, every release — which is precisely the thing this
repo says it will not ship.

## The manifest

`@elirobinson/tokens` now ships `src/migrations.json`, exported as
`@elirobinson/tokens/migrations` with its schema in `migrations.d.mts`. Each
entry names the tokens it applies to, the version it landed in, the replacement
if there is one, **the context that disambiguates it**, and the human reason:

```json
{
  "id": "warning-needs-an-edge",
  "since": "0.9.0",
  "kind": "rename",
  "from": ["--status-warning"],
  "to": "--status-warning-border",
  "when": { "properties": ["border", "border-color", "outline-color", "…"] },
  "report": "occurrence",
  "reason": "--status-warning is 1.87:1 on --bg in light. …",
  "guidance": "Keep the fill. Move only the edge."
}
```

The `when` block is the whole point. `--status-warning` as a `background` is
correct and must be left alone; the same token as a `border-color` has to move.
An entry with no `when` applies everywhere; `blockMentions` plus
`blockProperties` express "this text is drawn on a status fill" precisely enough
to tell it apart from "a status token appears somewhere in this block".

Four kinds, and only one of them is ever rewritten:

| `kind`    | What it means                         | What happens          |
| --------- | ------------------------------------- | --------------------- |
| `rename`  | replaced by a differently-named token | rewritten, in context |
| `repoint` | same name, different value            | reported              |
| `review`  | still valid, wrong in this context    | reported              |
| `removed` | gone, no replacement                  | reported              |

## The command

```bash
pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate
pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate --write
```

Read-only until `--write`, the same as every other `ds-resync` command. It reads
the manifest out of your `node_modules` — not out of `ds-resync` — so the
migrations you get are the ones the version you just installed shipped with. The
range comes from `.claude/ds-resync.json`, which `ds-resync --write` now leaves
behind, so in the normal flow the command takes no arguments. `--from` and
`--to` are there for a repo that upgraded some other way.

**It refuses more than it rewrites, deliberately.** A token assigned to one of
your own custom properties, a `borderColor` inside a ternary, a value whose name
did not change — each is reported with a `why not` and a `use:` line and left
exactly where it is. `bumpRange` in this same CLI has always returned null for a
range it could not rewrite safely rather than guessing at your intent; this
holds the same line over a much larger blast radius. There is no `--force`.

`--fail-on-pending` exits 2 while anything is still left for a human.

## The manifest cannot go stale

A migration manifest that drifts is worse than none, because the tooling built
on it will be trusted. So it is not allowed to be the author's memory of what
they changed. `packages/tokens` commits the previous token roster and
`migrations.test.mjs` derives what actually moved between it and the stylesheets
on disk; a token removed or repointed with no entry naming it fails the build,
by name:

```
1 token repointed with no migration entry:
  --status-success

A consumer has these in their own CSS and TSX. Add an entry to migrations.json
naming each one in its `from`, then accept the new roster with:
  node scripts/accept-token-baseline.mjs
```

The other direction is checked too: a `to` naming a token that is not declared
anywhere would have `--write` writing a dead variable into your stylesheet.

## Also in this release

`@elirobinson/eslint-config` gains
`@elirobinson-css/no-mismatched-status-foreground`, enabled by
`designSystemCss()`. A changelog cannot reach your own stylesheets and a codemod
only runs when you run it; a lint rule catches the same three defects every time
anyone writes them again — a theme-flipping foreground on a status fill,
`--status-warning` painting an edge, and `--fg-on-signal` in new code.
