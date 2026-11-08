---
'@elirobinson/ai-patterns': minor
---

Ship migration patterns for sites moving onto the system (#322).

`ds-resync artifacts --write` now installs a `ds-migrate` skill at
`.claude/skills/ds-migrate/`. It covers two jobs:

- **Adopt.** One file per source system: raw Tailwind, shadcn/ui, MUI, Bootstrap and
  hand-written CSS. Each maps colour, type, spacing, radius, shadow and the common
  components onto tokens and `@elirobinson/react` components, with before and after code.
- **Upgrade.** `upgrade.md` has one section per breaking change in every
  `@elirobinson/*` package, with the version, the changeset, what to search for, and before
  and after code. Token changes point at `ds-resync migrate`.

The same files are exported at `@elirobinson/ai-patterns/migrate/*.md`. The adopt prompt
and the `ds-resync` skill now point at them.

Every component, prop, token, Tailwind utility and class name in the "after" code is
checked against the published manifest, token stylesheets and Tailwind bridge, and linted
with `@elirobinson/eslint-config`. `upgrade.md` is checked against the changelogs and
`@elirobinson/tokens/migrations`, so a rename or a new breaking change fails CI rather
than leaving the files wrong.
