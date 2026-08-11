# Design: `ds-resync` — keep consuming repos current with the design system

**Date:** 2026-08-10
**Package:** `@elirobinson/ai-patterns` (new `ds-resync` bin + skill)
**Also touches:** `packages/{react,tokens,ai-patterns}/package.json` (`files` array)

## Problem

Repos scaffolded from `create-elirobinson-design-system` pin whatever versions of
`@elirobinson/tokens` and `@elirobinson/react` were current on the day they were created.
The scaffold template still declares `^0.1.0` for both; the published packages are at
`0.2.0` and `1.1.0`. Nothing in a consuming repo tells you that you are behind, what
changed while you were away, or which of your call sites the changes broke.

Upgrading is currently a manual archaeology exercise: check npm for the latest version,
bump by hand, install, then discover breakage at build time with no explanation. The
changesets prose that would explain the break — real migration notes, written at the time
of the change — is stranded in this repo and never reaches the consumer.

## Approach

A `ds-resync` bin published in `@elirobinson/ai-patterns`, run in any consuming repo
without installing anything:

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync
```

This works because the scaffold's `.npmrc` already points the `@elirobinson` scope at
`npm.pkg.github.com`, and the user-level auth token needed to install the packages is the
same one needed to fetch them here.

Paired with `src/skills/ds-resync/SKILL.md`, shipped through the package's `exports`,
which tells an agent to run the CLI, read the report, and apply the migrations the
changelog describes.

### Division of labour

The CLI does everything deterministic — detection, comparison, changelog extraction,
range rewriting. The agent does the part that requires judgment: reading "`NavigationMenu`
made `href` optional" and finding the call sites in _this_ repo that need to change.

The CLI is useful with no agent present. The skill is useless without the CLI. That
ordering is deliberate: the mechanical layer is testable and the judgment layer is thin.

## Behaviour

### Default run (read-only)

1. **Detect.** Read `package.json` in cwd. Collect every `@elirobinson/*` entry across
   `dependencies`, `devDependencies`, and `peerDependencies`. Scope-matched rather than a
   hardcoded list of three, so packages added later are picked up with no code change.
   Resolve the _installed_ version from `node_modules/<pkg>/package.json`; fall back to
   the declared range when the package is not installed.
2. **Query.** `npm view <pkg> version` against the scope's registry for the latest
   published version.
3. **Fetch notes.** For each outdated package, `npm pack <pkg>@<latest>` into a temp
   directory, extract `CHANGELOG.md` from the tarball, and slice the entries strictly
   newer than the installed version.
4. **Report.** Per package: `current → latest`, the semver jump class, and the sliced
   changelog prose. Major jumps are flagged as breaking.

The repo is not modified. Temp directories are cleaned up.

`--json` emits the same data structured, so the skill parses a contract rather than
scraping formatted text.

### `--write`

Rewrites the `@elirobinson/*` ranges in `package.json` and runs install.

Range style is preserved rather than normalised: `^1.1.0` becomes `^1.4.0`, a pinned
`1.1.0` becomes `1.4.0`, `~1.1.0` becomes `~1.4.0`. A repo that pins deliberately stays
pinned.

Package manager is detected from the lockfile — `pnpm-lock.yaml` → pnpm,
`package-lock.json` → npm, `yarn.lock` → yarn — defaulting to pnpm when none is found.

### Flags

| Flag                 | Effect                                        |
| -------------------- | --------------------------------------------- |
| _(none)_             | Read-only report                              |
| `--write`            | Apply bumps and install                       |
| `--json`             | Structured output                             |
| `--cwd <dir>`        | Target a directory other than the process cwd |
| `--fail-on-outdated` | Exit 2 when anything is behind (for CI)       |

Exit codes: `0` success, `1` error, `2` only with `--fail-on-outdated`. A bare run that
finds outdated packages still exits `0` — being behind is information, not failure.

## Prerequisite: publish the changelogs

`packages/react/package.json` declares `files: ["dist", "src"]`; tokens and ai-patterns
are equivalent. npm auto-includes `package.json`, `README`, and `LICENSE` — but **not**
`CHANGELOG.md`. The published tarballs therefore carry no migration notes, and the source
repo is private, so there is no raw-GitHub fallback.

Add `"CHANGELOG.md"` to the `files` array in all three packages. Without it, step 3 above
finds nothing and the migration half of the feature does not exist.

This is the only change outside the new code, and it takes effect on the next publish —
the CLI must degrade gracefully against already-published versions that lack the file.

## Structure

Four modules under `packages/ai-patterns/src/resync/`, plus the CLI that wires them:

| Module          | Responsibility                                                                      | Depends on          |
| --------------- | ----------------------------------------------------------------------------------- | ------------------- |
| `detect.mjs`    | `package.json` + `node_modules` → list of `{name, declaredRange, installedVersion}` | fs                  |
| `registry.mjs`  | latest version for a package; tarball → `CHANGELOG.md` text                         | network, subprocess |
| `changelog.mjs` | changelog markdown + version bounds → sliced entries                                | pure                |
| `apply.mjs`     | range rewriting; lockfile → package manager                                         | fs                  |
| `cli.mjs`       | argument parsing, orchestration, formatting                                         | all of the above    |

`registry.mjs` is the only module that touches the network or spawns subprocesses. That
containment is what makes the rest unit-testable without fixtures for npm's behaviour.

## Failure handling

The CLI is run in repos it did not create, so it assumes nothing:

- **No `@elirobinson/*` deps** — report that and exit `0`. Not an error.
- **Registry unreachable or unauthenticated** — the 401 from a missing/expired PAT is the
  most likely real-world failure. Report it with the fix (set the token), exit `1`.
- **No `CHANGELOG.md` in the tarball** — report versions without notes rather than
  failing. This is the expected state for every version published before the prerequisite
  change lands.
- **Package not installed** — compare against the declared range, and say so.
- **Install fails under `--write`** — `package.json` has already been rewritten; report
  what changed so the state is recoverable by hand.

## Testing

Vitest added to `packages/ai-patterns` (matching `packages/react`), with `test` in
`package.json` and the target wired in `project.json`.

Unit tests over the pure logic: changelog slicing across patch/minor/major boundaries and
against a changelog with no matching entries; version comparison including prerelease
tags; range-style preservation across `^`, `~`, pinned, and `*`; package-manager
detection from each lockfile; scope matching across all three dependency blocks.

`registry.mjs` is stubbed — no network in tests.

## Out of scope

- **Workspace traversal in the target repo.** One `package.json` at cwd; `--cwd` points
  elsewhere. Multi-package consuming repos run it per package.
- **Refreshing agent artifacts** (skill folder, `contracts.json`, `llms.txt` snapshot) in
  the consuming repo. Considered and set aside; versions and migration notes first.
- **Applying the migrations automatically.** The CLI reports; the agent edits. Codemods
  are a larger question and the changelog prose does not currently encode them
  mechanically.
