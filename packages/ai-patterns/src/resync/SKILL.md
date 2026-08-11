---
name: ds-resync
description: Use this skill to bring a repo's Miltinson Design System packages (@elirobinson/tokens, @elirobinson/react, @elirobinson/ai-patterns) up to the latest published versions, and to migrate the code for anything that changed. Use when the user asks to update, upgrade, or re-sync the design system.
user-invocable: true
---

# Re-sync the design system

This repo depends on `@elirobinson/*` packages published from a private
registry. This skill brings them current and fixes what the upgrade breaks.

## 1. See what's behind

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync --json
```

This is read-only — it never modifies the repo. It prints one record per
`@elirobinson/*` dependency:

- `installedVersion` / `latestVersion` — where the repo is and where it could be
- `jump` — `major`, `minor`, `patch`, `prerelease`, or `none`. Below 1.0.0 a
  minor bump is reported as `major`, because these packages make no stability
  promise before 1.0.
- `entries` — the changelog entries the repo missed, newest first, each with a
  `version` and a `body`
- `skipped` — set when the declared range was too complex to rewrite safely

If nothing is outdated, say so and stop.

If the command fails with a 401, the repo's registry token is missing or
expired. Report the fix it prints; do not try to work around it.

An empty `entries` array on an outdated package means that version was
published before the packages started shipping `CHANGELOG.md`. Treat it as
"notes unavailable", not "nothing changed" — a major jump still needs care.

## 2. Read the changelog entries before upgrading

The `body` of each entry is prose written at the time of the change. Entries
under a `### Major Changes` heading are breaking; read those carefully and note
which APIs they name.

Search this repo for call sites touching those APIs **before** running the
upgrade, so you know the blast radius. Report it to the user: which packages,
what jump, and how many call sites are affected.

## 3. Apply

Once the user agrees:

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync --write
```

This rewrites the ranges in `package.json` (preserving `^`, `~`, or a pin) and
runs the repo's package manager install.

If it reports that `package.json` was updated but the install exited non-zero,
the ranges have already changed. Read the install output before re-running —
some package managers exit non-zero on warnings that are not install failures.

## 4. Migrate

Fix the call sites the breaking entries described. Follow the repo's existing
conventions. Constraints that always apply:

- Imports use package subpaths only — `@elirobinson/react/components/<tier>/<Name>`.
  A bare `@elirobinson/react` import does not resolve.
- `@elirobinson/tokens/tokens.css` and `@elirobinson/react/styles.css` are
  imported once, in the app shell, in that order.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`), never raw scale
  values (`--ink-500`).

For the full component inventory and prop tables at the new version, read the
docs site's `/llms-full.txt`.

## 5. Verify

Run the repo's own checks — typecheck, tests, build — and report the results. Do
not claim the upgrade is done until they pass.
