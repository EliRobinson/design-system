# AI Agent Rules

> `CLAUDE.md` is a symlink to this file — edit here only.

Always use conventional commit messages.

## UI is built on the Miltinson Design System

Every screen in this repo is assembled from `@elirobinson/react` and `@elirobinson/tokens`.
Do not hand-roll a button, field, card, or colour value, and do not add another UI library.

**Never work from a remembered or pasted inventory.** Any list of components, props, or
tokens is wrong as of the next release. Ask the installed packages instead:

```bash
pnpm ds                  # components, exports, variants, hooks, typography, token groups
pnpm ds props <Name>     # props, variant unions, and the exact import line to copy
pnpm ds tokens [filter]  # tokens and their values
pnpm ds contracts        # the machine-checkable rules UI here must satisfy
pnpm ds patterns         # working principles and the definition of done
```

Those need `@elirobinson/ai-patterns` as a dev dependency and `"ds": "elirobinson-ds"` in
`scripts`. `pnpm exec elirobinson-ds` is the same command before the script exists.

## Skills, and how to refresh them

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync artifacts --write
```

That writes, and later refreshes, three skills under `.claude/skills/`:

| Skill                     | What it is                                                     |
| ------------------------- | -------------------------------------------------------------- |
| `miltinson-design`        | Brand voice, colour, type, assets, UI kits                     |
| `design-system-reference` | Version-stamped component inventory, prop tables, token values |
| `ds-resync`               | How to bring this repo's design system packages up to date     |

Read them; do not copy their contents into this file. Re-running the command updates what
it wrote and leaves anything you edited alone, reporting each file it skipped.

If `design-system-reference` warns that its snapshot is stale, the packages moved without
the skills following. Run `pnpm dlx @elirobinson/ai-patterns ds-resync` first, then the
artifacts command again.

## Non-negotiables

- Imports name a subpath — `@elirobinson/react/components/<tier>/<Name>`. A bare
  `@elirobinson/react` import does not resolve.
- `@elirobinson/tokens/tokens.css` then `@elirobinson/react/styles.css`, once, in the app
  shell. On Tailwind v4, `@elirobinson/tokens/tailwind.css` after them.
- Colours, spacing, radii, shadows, and durations come from tokens. Semantic tokens
  (`--fg`, `--surface`, `--accent`) in app code, never raw scale values (`--ink-500`).
- Dark mode is `[data-theme="dark"]`.
- Before calling UI work done, run `pnpm ds patterns` and work the checklist it prints.
