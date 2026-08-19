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
pnpm --package=@elirobinson/ai-patterns dlx ds-resync --json
```

This is read-only — it never modifies the repo.

**It compares the versions the lockfile resolved — what CI and a fresh clone
install — against the registry, and separately reports when `node_modules`
disagrees with that lockfile.** `node_modules` is never the baseline: an install
that has drifted ahead of the committed manifests would otherwise make the repo
look current while the version it actually builds is majors behind.

It prints one record per `@elirobinson/*` dependency:

- `currentVersion` / `targetVersion` / `latestVersion` — where the repo is, where
  this run would take it, and the newest thing published
- `currentSource` — where `currentVersion` came from: `lockfile` (normal),
  `range` (no lockfile entry, so the declared range's floor is standing in — a
  weaker claim), or `unresolved` (the range names no published version, e.g.
  `workspace:*`, and the package was not compared at all)
- `lockedVersion` / `installedVersion` — the lockfile's answer and
  `node_modules`' answer, kept apart. Either can be `null`.
- `target` — the distance requested for this package: `latest`, `minor`, or `patch`
- `heldBack` — true when `targetVersion` is below `latestVersion` because of `target`.
  A held-back package is not "current"; a newer version is waiting.
- `jump` — `major`, `minor`, `patch`, `prerelease`, or `none`. Below 1.0.0 a
  minor bump is reported as `major`, because these packages make no stability
  promise before 1.0.
- `entries` — the changelog entries the repo missed, newest first, each with a
  `version` and a `body`
- `skipped` — set when the declared range was too complex to rewrite safely

Alongside the packages, a top-level `drift` array lists every package whose
`node_modules` copy disagrees with the lockfile — see step 1b.

If nothing is outdated and `drift` is empty, say so and stop.

If the command fails with a 401, the repo's registry token is missing or
expired. Report the fix it prints; do not try to work around it.

An empty `entries` array on an outdated package means that version was
published before the packages started shipping `CHANGELOG.md`. Treat it as
"notes unavailable", not "nothing changed" — a major jump still needs care.

## 1b. If it reports NODE_MODULES OUT OF SYNC

A non-empty `drift` means `node_modules` holds different versions from the
lockfile. **Deal with this before anything else**, because while it holds, every
tool that introspects installed code is answering for a version this repo does
not build — including `pnpm ds` and `pnpm ds props <Name>`. Code written against
those answers compiles locally and breaks in CI.

The fix is an install, not an upgrade:

```bash
pnpm install
```

Then re-run step 1. Do not "fix" drift by upgrading `package.json` to match what
happens to be installed — that changes what the repo ships in order to match a
local accident.

In CI, `--fail-on-out-of-sync` exits 2 on this condition. It is separate from
`--fail-on-outdated`, which exits 2 when something is behind: different causes,
different fixes. (Both are distinct from `ds-resync artifacts --fail-on-drift`,
which is about the generated snapshot, not about `node_modules`.)

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
pnpm --package=@elirobinson/ai-patterns dlx ds-resync --write
```

This rewrites the ranges in `package.json` (preserving `^`, `~`, or a pin) and
runs the repo's package manager install. It also records the versions it
crossed in `.claude/ds-resync.json`, which is where step 4 reads the range it
migrates across — nothing else on disk remembers where the upgrade started once
the install has happened.

If it reports that `package.json` was updated but the install exited non-zero,
the ranges have already changed. Read the install output before re-running —
some package managers exit non-zero on warnings that are not install failures.

## 3b. When a major is too much right now

If a package has a breaking major the user is not ready for, they do not have to
skip the upgrade entirely. Take everything below it:

```bash
pnpm --package=@elirobinson/ai-patterns dlx ds-resync --write --target react=minor
```

`--only react,tokens` restricts the run to named packages; the scope is optional.
`--target` accepts one distance for everything (`--target minor`) or per-package
assignments (`--target minor,react=latest`).

Offer this whenever the report shows a `major` jump the user hesitates over. Then
tell them what remains held back, so the deferred migration stays visible.

## 4. Migrate

The token migrations are mechanical. Run them rather than deriving them:

```bash
pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate
```

Dry-run by default, like everything else here. It reads the migration manifest
each installed `@elirobinson` package ships, selects the entries between the
version you upgraded from and the one you are on now, and finds their call sites
in this repo's CSS and TSX. Step 3 recorded that range at
`.claude/ds-resync.json`, so in the normal flow this takes no arguments.

Read the report, then apply it:

```bash
pnpm --package=@elirobinson/ai-patterns dlx ds-resync migrate --write
```

`--from <version>` and `--to <version>` supply the range by hand when the repo
was upgraded some other way — exact versions, never ranges. `--only` restricts
the run to named packages, `--cwd` targets another directory, `--json` emits the
report as data, and `--fail-on-pending` exits 2 when anything was left for a
human, which is the CI spelling.

**Do not re-derive token renames from the changelog prose you read in step 2.**
The manifest is that same change expressed as data, checked against the
package's own stylesheets by its own test, and it knows which occurrences are
safe to rewrite and which are not. A hand-written find/replace over the same
tokens is a guess at what the command already knows.

**The manifest is tokens and nothing else.** Component API changes, renamed
props, new required props, changed import paths, removed components — those are
still yours, and the entries from step 2 are the only description of them.

What the command declines to rewrite it prints under `left for you — not
rewritten, on purpose`, each with a `why not:` line and, where a replacement
exists, a `use:` line. Those are deliberate refusals, not failures: a token
aliased through one of your own custom properties, a property it could not read
at that position, a token whose value moved but whose name did not, a
replacement that depends on which fill an element is actually painted with.
There is no force flag, by design — rewriting those would change what this repo
paints without saying so. Resolve each one by hand at the file and line printed.

A package below the version that first ships a manifest reports nothing, and
that is not a failure. Token migrations ship in `@elirobinson/tokens` from
0.9.0; below that, the changelog entries from step 2 are the migration notes and
the call sites are yours to fix.

Constraints that always apply:

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
pnpm --package=@elirobinson/ai-patterns dlx ds-resync artifacts --write
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

Run the repo's own checks — typecheck, tests, build — and report the results. If
step 4 ran with `--write`, run the repo's formatter first: those rewrites are
edits to the bytes, not formatted output. Do not claim the upgrade is done until
the checks pass.
