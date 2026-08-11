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

- `installedVersion` / `targetVersion` / `latestVersion` — where the repo is, where this
  run would take it, and the newest thing published
- `target` — the distance requested for this package: `latest`, `minor`, or `patch`
- `heldBack` — true when `targetVersion` is below `latestVersion` because of `target`.
  A held-back package is not "current"; a newer version is waiting.
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

## 3b. When a major is too much right now

If a package has a breaking major the user is not ready for, they do not have to
skip the upgrade entirely. Take everything below it:

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync --write --target react=minor
```

`--only react,tokens` restricts the run to named packages; the scope is optional.
`--target` accepts one distance for everything (`--target minor`) or per-package
assignments (`--target minor,react=latest`).

Offer this whenever the report shows a `major` jump the user hesitates over. Then
tell them what remains held back, so the deferred migration stays visible.

## 4. Migrate

Fix the call sites the breaking entries described. Follow the repo's existing
conventions. Constraints that always apply:

- Imports use package subpaths only — `@elirobinson/react/components/<tier>/<Name>`.
  A bare `@elirobinson/react` import does not resolve.
- `@elirobinson/tokens/tokens.css` and `@elirobinson/react/styles.css` are
  imported once, in the app shell, in that order.
- Reference semantic tokens (`--fg`, `--surface`, `--accent`), never raw scale
  values (`--ink-500`).

For the full component inventory and prop tables, run `pnpm ds` and
`pnpm ds props <Name>` — they read the installed package, so they are correct by
construction. To read the system in bulk instead, use
`.claude/skills/design-system-reference/llms-full.txt`, which step 5 refreshes.

## 5. Re-sync the agent artifacts

The upgrade moved the packages; the skills in `.claude/skills/` still describe the
old ones. Bring them along:

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync artifacts --write
```

This rewrites the brand skill, the version-stamped component reference
(`llms.txt` / `llms-full.txt`), and this file. Any of them you have edited
locally are left alone and named in the output — reconcile those by hand, or
re-run with `--force` to take the shipped copy.

Read the output. If it prints a **STALE SNAPSHOT** warning, the artifacts and the
installed `@elirobinson/react` disagree; the most likely cause is that
`@elirobinson/ai-patterns` itself is behind, so run the default `ds-resync` first
and then repeat this step.

## 6. Verify

Run the repo's own checks — typecheck, tests, build — and report the results. Do
not claim the upgrade is done until they pass.
