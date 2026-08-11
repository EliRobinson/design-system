# Design: selective upgrades for `ds-resync`

**Date:** 2026-08-10
**Package:** `@elirobinson/ai-patterns` (extends `src/resync/`)
**Builds on:** `docs/superpowers/specs/2026-08-10-ds-resync-design.md`

## Problem

`ds-resync --write` is all-or-nothing: every outdated `@elirobinson/*` package moves to
`latest`. That is the wrong shape for the case that actually blocks an upgrade.

When `@elirobinson/react` publishes a breaking `2.0.0`, a consuming repo that is not ready
to migrate has no way to take the `1.x` fixes it does want. Its only options today are
upgrade everything to latest, or upgrade nothing. So it upgrades nothing, and drifts
further — which is the exact failure the tool was built to prevent.

There is also no way to move one package while holding another back.

## Approach

Two independent axes of control, plus an interactive mode that walks both.

### Axis 1: how far to jump

A `target` per package, resolved against the full published version list rather than
against `latest` alone:

| Target             | Meaning                                        |
| ------------------ | ---------------------------------------------- |
| `latest` (default) | Newest published version                       |
| `minor`            | Highest version inside the current major       |
| `patch`            | Highest version inside the current major.minor |

`--target minor` on a repo at `react@1.0.2` with `1.4.0` and `2.0.0` published resolves to
`1.4.0`. The breaking major is left alone and reported as held back.

Prereleases are never selected. A repo already on a prerelease still compares correctly —
`selectTarget` only excludes prereleases from the _candidate_ set, so a repo on
`1.0.0-beta.1` is offered `1.0.0`.

### Axis 2: which packages

- `--only react,tokens` — restrict the run to these packages. Accepts short names
  (`react`) or fully qualified ones (`@elirobinson/react`); requiring the scope on every
  invocation is friction with no benefit, since the scope is fixed.
- `--target minor` — one target for every package.
- `--target react=minor,tokens=latest` — per-package targets. A bare target in the same
  argument sets the default for packages not named: `--target minor,react=latest`.

`--except` is deliberately omitted. With three packages `--only` covers the same ground,
and two overlapping filters invite contradictory invocations.

### Interactive mode

`--interactive` / `-i` walks the outdated packages one at a time, asking whether to update
each and, when yes, how far. It then applies the result.

Two decisions that shape this:

**It is opt-in, not the default.** A bare `ds-resync` stays a read-only report that an
agent can parse — that property is what makes the tool scriptable, and it is not worth
trading for interactivity that only humans use.

**`-i` implies `--write`.** Asking "do you want to update react?" and then not updating it
is absurd. The flag is explicit enough to carry the intent on its own.

When stdin is not a TTY, `-i` exits `1` with a directed message rather than prompting.
Otherwise it would hang a CI job or an agent invocation forever, which is the worst
available failure mode.

## Report

When a target holds a package below `latest`, the report says so. Silently reporting
`1.4.0` as though it were current would hide the pending major:

```
2 packages behind:

  @elirobinson/react  1.0.2 → 1.4.0  (minor)
    2.0.0 is available, held back by --target minor

  @elirobinson/tokens  0.1.0 → 0.2.0  (major)  [breaking]
```

The `--json` output gains `targetVersion`, `latestVersion`, and `heldBack` (boolean) per
package, so the skill can distinguish "current" from "as current as you asked for".

## Structure

Changes are additive; no existing module changes responsibility.

| Module         | Change                                                                |
| -------------- | --------------------------------------------------------------------- |
| `semver.mjs`   | Add `selectTarget(current, versions, target)` — pure                  |
| `registry.mjs` | Add `fetchAllVersions(name, options)`                                 |
| `prompt.mjs`   | **New.** Interactive walk over outdated packages                      |
| `cli.mjs`      | Parse `--only` / `--target` / `--interactive`; thread targets through |

`prompt.mjs` takes its input channel as a parameter rather than reaching for
`process.stdin` directly, so the walk is testable without a TTY.

`fetchAllVersions` replaces `fetchLatestVersion` at the call site in `cli.mjs` — one
`npm view <pkg> versions --json` call yields everything needed to resolve any target, so
this costs no extra network round trip. `fetchLatestVersion` is retained; it is the
narrower, cheaper call and remains the right tool if anything later needs only the tip.

## Failure handling

- **Unknown name in `--only`** — error listing the `@elirobinson/*` packages actually
  found in this `package.json`, exit `1`. Silently ignoring a typo would report "nothing
  to do" and look like success.
- **Unknown target value** — error naming the three valid targets, exit `1`.
- **`--only` matches nothing outdated** — report that and exit `0`. Not an error.
- **Target resolves to the installed version** — report as up to date, with the held-back
  note if a higher version exists.
- **`-i` without a TTY** — exit `1` with a message pointing at `--only` / `--target` as
  the non-interactive equivalent.
- **`-i` interrupted (Ctrl-C / EOF)** — exit `1` without writing. Nothing is applied until
  the whole walk completes.

## Testing

`selectTarget` carries most of the weight, being pure: resolution for each of the three
targets; a package already at its ceiling; prereleases excluded from candidates but valid
as the current version; an empty version list; a version list containing only versions
older than current.

Argument parsing: `--only` with short and qualified names, `--target` global, `--target`
per-package, the mixed form, unknown package, unknown target.

`prompt.mjs`: the walk over a scripted input channel — accept all, decline all, mixed, and
EOF partway through.

Report formatting: the held-back line appears only when a higher version exists.

## Out of scope

- **Artifact sync.** Agreed as a separate spec, to follow this one, covering the brand
  skill, contracts, prompts, and a generated `llms` snapshot — and the packaging work that
  makes them reachable from a consuming repo.
- **Applying migrations.** Unchanged from the original spec: the CLI reports, the agent
  edits.
- **Range-shape changes.** `--target` selects a version; it does not change whether the
  written range is a caret, tilde, or pin. That still follows what the consumer declared.
