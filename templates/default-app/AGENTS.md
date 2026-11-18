# AI Agent Rules

> `CLAUDE.md` is a symlink to this file, so edit this file only.

Always use conventional commit messages.

## UI is built on the Miltinson Design System

Every screen in this repo is assembled from `@elirobinson/react` and `@elirobinson/tokens`.
Use their buttons, fields, cards, and colour values instead of hand-rolling them, and do not
add another UI library.

A remembered or pasted list of components, props, or tokens goes stale with the next
release, so ask the installed packages instead:

```bash
pnpm ds                  # components, exports, variants, hooks, typography, token groups
pnpm ds props <Name>     # props, variant unions, and the exact import line to copy
pnpm ds tokens [filter]  # tokens and their values
pnpm ds dials            # palette/theme/platform: attributes, values, defaults
pnpm ds contracts        # the machine-checkable rules UI here must satisfy
pnpm ds patterns         # working principles and the definition of done
```

Those need `@elirobinson/ai-patterns` as a dev dependency and `"ds": "elirobinson-ds"` in
`scripts`. `pnpm exec elirobinson-ds` is the same command before the script exists.

## Skills, and how to refresh them

```bash
pnpm --package=@elirobinson/ai-patterns dlx ds-resync artifacts --write
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
the skills following. Run `pnpm --package=@elirobinson/ai-patterns dlx ds-resync` first,
then the artifacts command again.

## Non-negotiables

- Import each component by its subpath, `@elirobinson/react/components/<tier>/<Name>`.
  There is no barrel export, so a bare `@elirobinson/react` import does not resolve.
- Import `@elirobinson/react/styles.css` once, in the app shell (`app/globals.css`). It
  already imports `@elirobinson/tokens/tokens.css`; importing `tokens.css` as well bundles
  it twice. An app that does not import `styles.css` (per-component sheets only) imports
  `@elirobinson/tokens/tokens.css` itself. On Tailwind v4, that one stylesheet import goes in
  the CSS entry, in this order: `@import 'tailwindcss'`, then the design system stylesheet
  (`@elirobinson/react/styles.css` or `@elirobinson/tokens/tokens.css`), then
  `@import '@elirobinson/tokens/tailwind.css'`, which maps Tailwind's color namespace onto
  the tokens.
- Take colours, spacing, radii, shadows, and durations from tokens. In app code, use
  semantic tokens (`--fg`, `--surface`, `--accent`) rather than raw scale values
  (`--ink-500`), so the theme dial can flip them.
- The three dials (palette, theme, platform) are root-element attributes, and an absent
  attribute is that dial's default. `pnpm ds dials` prints the attributes, their values,
  and which tokens each one moves. `lib/dials.ts` writes the two a person chooses.
- Before calling UI work done, run `pnpm ds patterns` and work the checklist it prints.
