---
name: ds-migrate
description: Use this skill to move an existing website onto the Miltinson Design System (@elirobinson/react, @elirobinson/tokens). It covers two cases - a site with no design system yet (raw Tailwind, shadcn/ui, MUI, Bootstrap or hand-written CSS) and a site on an older @elirobinson/* version. Use when the user asks to adopt, migrate to, convert to, or upgrade the design system.
user-invocable: true
---

# Migrate a site onto the design system

Two jobs, two starting points. Work out which one this repo needs first.

```bash
grep -n '"@elirobinson/' package.json
```

- **No `@elirobinson/*` dependency:** this is an **adopt**. Go to "Adopt" below.
- **An `@elirobinson/*` dependency:** this is an **upgrade**. Go to "Upgrade" below.

Both can apply: a site on an old version that still has MUI screens upgrades first, then
adopts the rest.

## Adopt

1. Read `adopt-system.md` in this folder. Do its Step 0 (install, lint, agent files,
   stylesheet imports) before touching any screen.
2. Find what the site is built with. Read every file below that matches. Most sites match
   more than one: shadcn/ui sits on Tailwind, and every site has some plain CSS.

   | The repo has                                              | Read                 |
   | --------------------------------------------------------- | -------------------- |
   | `tailwindcss` in `package.json`                           | `adopt/tailwind.md`  |
   | `components.json`, or `components/ui/` with Radix         | `adopt/shadcn.md`    |
   | `@mui/material` in `package.json`                         | `adopt/mui.md`       |
   | `bootstrap` or `react-bootstrap`, or `btn btn-` in markup | `adopt/bootstrap.md` |
   | Its own `.css`, `.scss` or CSS Modules files              | `adopt/plain-css.md` |

3. Move one screen at a time. For each: swap the components, then move the remaining
   values onto tokens, then check keyboard and focus. Leave the app shippable after
   every screen.
4. Each adopt file maps colour, type, spacing, radius, shadow and components, with before
   and after code. Map colour by **role** (page, card, body text, action), never by hue.
   Map sizes by **pixels**, to the nearest step.

## Upgrade

1. Follow the `ds-resync` skill (`.claude/skills/ds-resync/SKILL.md`). It finds what is
   behind, applies the upgrade, and runs the token migrations for you.
2. Read `upgrade.md` in this folder for the version range you crossed. It has one section
   per breaking change, with what to search for and before and after code. Run every
   section's **Find**, even outside your range: code can lag its declared version. The
   sections with a **Token migration** line are done by `ds-resync migrate`; run it rather
   than editing by hand.

## Rules for both

- Ask the installed packages, not your memory. `pnpm ds` lists components.
  `pnpm ds props <Name>` prints the props and the import line. `pnpm ds tokens <filter>`
  prints tokens. The tables in these files name what to reach for; `pnpm ds` is the
  authority on what exists. Before the `ds` script exists, use `pnpm exec elirobinson-ds`.
- Imports name a subpath: `@elirobinson/react/components/<tier>/<Name>`.
- Semantic tokens only (`--fg`, `--surface`, `--accent`). Never a raw scale step.
- Never restyle a system component to look like the old one. If it cannot do the job,
  say so in the migration report.
- `pnpm lint` with `@elirobinson/eslint-config` is the finish line for each screen. It
  finds palette colours, literal values, banned imports and old UI libraries.

## Report

End with a short report: what moved, what is left, and every place the system had no
component or token for what the site needed.
