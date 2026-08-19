# Design: scope the visual suite to the change, and move the full sweep off pull requests

**Date:** 2026-08-19
**Touches:** `.github/workflows/visual.yml`, `scripts/`, `playwright.config.ts`, `docs/agents/visual-regression.md`
**Does not touch:** `quality.yml`, `release.yml`, `deploy.yml`, `visual-update.yml`

## Problem

The visual suite runs its full 501-test sweep (492 baselines) on every pull request, and three separate
costs are stacked on top of one another. They have different causes and different fixes,
and conflating them is why the job feels uniformly slow rather than specifically broken.

**A green run has a ~7-minute floor, and it is all screenshots.** Measured on run
`32231727500` (push to `main`): container init, checkout, install and both app builds
total ~90 seconds — the Storybook and docs builds together are only 27 of those. The
`Visual regression` step alone is **6m56s**. That is 492 baselines captured serially,
about 0.85s each. Serial is deliberate and must stay: issue #65 measured serial → 3
workers taking a run from 1 failure to 18, which makes worker contention the single
largest amplifier of flake in this suite. So the 7 minutes cannot be bought back by
parallelising within the job. It can only be bought back by capturing fewer shots.

**A pull request that adds a component costs ~14 minutes and fails, and this is the cost
that actually bites.** Run `32230790517` (PR #88, `cabin-whisperer`) reported **210 failed,
359 passed, 13m47s**. The 210 split into two kinds, and the split is the most important
measurement in this document:

| failure                              | count   | what it is                                    |
| ------------------------------------ | ------- | --------------------------------------------- |
| `A snapshot doesn't exist at …`      | **68**  | new components and pages with no baseline yet |
| `Error: expect(…)` comparison failed | **142** | genuine pixel differences                     |
| storybook comparison failures        | **0**   | —                                             |

PR #88 adds ChatMessage, ChatThread, DecisionCard, StreamingCaret, StubCard and
VerdictBadge along with their docs pages. The 68 are new work with no baseline, and the
only way to mint one is to manually dispatch the **Visual update** workflow on the branch —
another ~11 minutes, and only if you know to do it. So the current design makes the routine
act of adding a component produce the most expensive and most alarming possible CI result.

The 142 are the finding that shaped the rest of this design. They are **142 unique docs
route-and-theme pairs — every pre-existing docs page, in both themes — and not one story.**
The cause is in `apps/docs/src/lib/site-map.ts:12`, which imports `components` from the
generated manifest; its own header records that the sidebar, header nav, homepage cards and
command palette all derive from that one registry. So:

> **Adding a component changes every docs page**, because the manifest-derived sidebar is
> rendered on all of them.

That is not a bug and there is nothing to fix in the site. It is a structural property of a
design system's documentation, and any scoping scheme that does not know it is dangerous —
see the constraint it imposes in Component 1.

**Nothing gates on any of it.** `main` has no branch protection and the repository has no
rulesets — `gh api repos/:owner/:repo/branches/main/protection` returns 404 and
`/rulesets` returns `[]`. `visual.yml` is additionally `continue-on-error: true`, so the
workflow run reports success even when the job fails. The only real gate in the repository
is `workflow_run: Quality succeeded` on `release.yml` and `deploy.yml`. The visual suite is
therefore paying full price on every pull request to produce a signal that blocks nothing
and, on component-adding branches, is dominated by noise it generates itself.

For contrast, `quality.yml` — build, lint, format, typecheck and test — is ~2 minutes end
to end. It is not the problem and this design does not touch it.

## Approach

Three independent changes, in the order they pay off.

1. **Mint missing baselines automatically on the pull request branch**, and give an
   _intended_ change to existing baselines a one-label accept path, so a component-adding
   pull request costs one re-run rather than an ~11-minute manual dispatch.
2. **Scope the pull request run to the change**, using Nx for the part Nx is authoritative
   about and a file-to-shot map for the part it structurally cannot see.
3. **Move the full sweep to `main` and a nightly schedule**, and give a red sweep a
   mechanical recovery path — a baselines pull request and a tracking issue that reference
   each other.

### Why Nx alone is not sufficient, and why it is still the right first layer

Nx's granularity is the project, derived from the real import graph. Measured against this
repository's graph (`tokens → react → {storybook, docs, ai-patterns, design-system-mcp}`):

| changed file                                       | `nx show projects --affected`                                      | consequence for the sweep         |
| -------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------- |
| `apps/docs/src/app/(docs)/patterns/forms/page.mdx` | `docs`                                                             | skips all **336** storybook shots |
| `packages/react/src/components/atoms/Button.tsx`   | `react, docs, storybook, ai-patterns, design-system-mcp, create-…` | **all 501**                       |
| `packages/tokens/src/index.ts`                     | everything                                                         | all 501                           |

So Nx answers "is `docs` affected? is `storybook` affected?" authoritatively and for free,
and that alone removes 60% of the sweep on a docs-only change. It cannot distinguish Button
from the entire component library, because any file under `packages/react` marks both
consumers affected. That is correct behaviour for a build tool and useless for selecting 30
screenshots out of 501.

The alternative — a hand-maintained table of "global paths" that force a full sweep — was
rejected. It is exactly the kind of prose that drifts silently from the thing it describes,
which is the failure mode `AGENTS.md` bans for consumers. Deriving the tier from the graph
means adding a package or an import cannot leave a stale list behind.

## Component 1: `scripts/visual-scope.mjs`

A pure module with no CI knowledge, unit-tested against fixture file lists in
`scripts/visual-scope.test.mjs` (the repository's existing `*.test.mjs` convention). Given
a base SHA it returns a plan:

```js
{ run: boolean, projects: string[], grep: string | null, reason: string }
```

**Layer 1 — Nx picks the tier.** Run `nx show projects --affected --base=<sha>`. If neither
`docs` nor `storybook` appears, `run: false` with a reason — a change to `eslint-config`,
`scripts/`, or a README has no shots to take.

**Layer 1a — the sidebar fan-out rule, applied before any narrowing.** Because the sidebar
is manifest-derived and rendered on every docs page, a change to _the set of things in the
registry_ changes every docs shot. Any of the following forces **all docs shots** and skips
layer 2 on the docs side:

- a file **added or deleted** under `packages/react/src/components/**`
- a page file **added or deleted** under `apps/docs/src/app/(docs)/**`
- any change to `apps/docs/src/lib/site-map.ts` or `apps/docs/src/lib/manifest.ts`
- any change to the site chrome — the `(docs)` layout, `SiteHeader`, or `site.css`

Added-or-deleted is the precise trigger, not modified: editing an existing component's
internals leaves the registry unchanged, so the sidebar is unchanged and narrowing stays
safe. This rule is what stops the scoper from turning PR #88 green while 142 stale docs
baselines ride onto `main`.

**Layer 2 — changed files narrow the leaf.** The mapping rests on naming conventions that
already exist in the repository, verified against the tree:

| changed path                                            | selects                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/react/src/components/<tier>/<Name>.{tsx,css}` | storybook `components-<lower(Name)>--*` and docs route `/components/<kebab(Name)>` |
| `apps/storybook/src/stories/<Name>.stories.tsx`         | storybook `components-<lower(Name)>--*`                                            |
| `apps/docs/src/app/(docs)/<route>/page.{mdx,tsx}`       | that route                                                                         |
| `apps/docs/src/components/demos/<slug>/**`              | docs route `/components/<slug>`                                                    |
| any other file in an affected project                   | **that project's shots in full**                                                   |

The two transforms come from one PascalCase name: `DatePicker` → storybook id
`components-datepicker--` and docs slug `date-picker`. Both are mechanical.

**Pattern construction, verified against `playwright test --list` on this branch.** Three
facts constrain it, and all three were measured rather than assumed:

- Playwright's `--grep` matches the **full title path**, which begins with the spec file
  path. A `^` anchor therefore matches nothing: `--grep "^/components/button · "` returned
  `Total: 0 tests`, while the same pattern without `^` returned 2.
- Story patterns keep the trailing `--`, which separates a story id from its component name
  and anchors the match. `components-button--` selects Button's 7 stories × 2 themes ×
  2 widths = 28, and does **not** select `components-dropdownmenu--with-button-trigger`,
  which a bare `button` would.
- Route patterns keep the trailing `·`, which anchors the route's end so
  `/components/card · ` cannot also match a hypothetical `/components/card-group`.

Combined with alternation, `--grep "components-button--|/components/button · "` returns
exactly **30** tests: 28 stories plus the 2 docs shots. The scoper's tests assert the
anchoring, because a pattern that over-matches only wastes time, while one that
under-matches loses coverage silently.

The last row is the important one. When a change cannot be narrowed — `styles.css`,
`src/lib/`, `.storybook/`, anything in `packages/tokens` — the fallback is the affected
project's shots, never the whole sweep and never nothing. A `packages/tokens` change runs
all 501 because it genuinely affects all 501.

**The guard fails loudly.** If a changed file matches a mapping rule but resolves to zero
shots — a component renamed without its docs slug, a story file whose title no longer
matches — the script exits non-zero and names the file. It does not fall back to a wider
run and it does not quietly narrow. `visual-sweep.test.mjs` already carries this principle:
a filter that silently drops a page produces a suite that looks fine and covers nothing. A
scoper that silently drops a component is the same bug one layer up.

## Component 2: `scripts/visual-missing.mjs`

Enumerates the shots the current build expects, using the same `storybookStories` and
`nextStaticRoutes` from `@elirobinson/ai-patterns/testing/visual-sweep` that the specs
themselves use, so it cannot disagree with the suite about what exists. Diffs that against
`tests/visual/__screenshots__/` and returns the missing set as a Playwright `--grep`
pattern.

Reusing the enumerators rather than re-globbing the filesystem is the whole point: a second
enumerator that could disagree with the first is how a shot stops being covered without
anyone noticing.

## Component 3: pull request job

Triggered on `pull_request` only. In one job, in order:

1. Build Storybook and the docs site (`pnpm run pretest:visual`).
2. Compute the missing set. If non-empty, run
   `playwright test --update-snapshots --workers=1 --grep '<missing>'` with
   `DS_VISUAL_CONTAINER=1`, and commit the new baselines to the pull request branch with a
   `test(visual): N new baselines` message. They appear in the pull request diff for
   review, which is where a new baseline should be looked at anyway.
3. Compute the scope and run `playwright test --workers=1 --grep '<scope>'` **without**
   `DS_VISUAL_CONTAINER`, so `updateSnapshots: 'none'` holds and a missing baseline at this
   stage is still a hard failure.
4. If step 3 failed **and** the pull request carries the `visual-accept` label, regenerate
   exactly the failing shots (read from `test-results/report.json`, as in Component 4) and
   commit them as `test(visual): accept N baselines`. Without the label, step 3's failure
   stands and the job summary lists the failing shots.

Steps 2 and 3 in one job matters: pushes made with `GITHUB_TOKEN` deliberately do not
trigger workflows, so a job that only committed baselines would leave the check red with no
re-run coming.

**Why the label is opt-in, and why it is a separate step from the auto-mint.** Step 2 only
ever creates baselines that do not exist; it can never overwrite one, so it cannot launder a
regression. Step 4 does overwrite, which is exactly the operation the zero-tolerance
comparison exists to put a human in front of — `threshold: 0` and `maxDiffPixels: 0` are
only meaningful if somebody decides what a diff means. Making acceptance the default would
convert every regression into a committed baseline that looks like intended work. The label
is the decision, the commit is its record, and the PNGs land in the pull request diff where
they can be reviewed. PR #88's 142 intended docs changes are the motivating case: one label,
one re-run, rather than an ~11-minute manual dispatch.

`continue-on-error` is dropped from this job. Its dominant false-red source — missing
baselines — is what step 2 removes, and a fast honest red is worth more than a slow
advisory one. Nothing is branch-protected, so this changes what the check _shows_, not what
it blocks.

**Fork degradation.** A `pull_request` event from a fork gets a read-only `GITHUB_TOKEN` and
step 2 cannot push. It detects this and fails with the explicit remedy —
`gh workflow run visual-update.yml --ref <branch> --field grep=<pattern>` — rather than an
opaque permissions error. The registry is restricted and forks are not part of this
repository's workflow, so this is a guard rail, not a supported path.

## Component 4: full sweep and its recovery path

Triggers become `push: main`, a nightly `schedule`, and `workflow_dispatch`. The sweep
itself is unchanged: full, `--workers=1`, in the pinned container.

Recovery is driven by data rather than log-scraping. `playwright.config.ts` gains a `json`
reporter writing `test-results/report.json`, from which the failing test titles are read
directly. On a red sweep:

1. Re-run `--update-snapshots --workers=1 --grep '<failing shots>'` on a new branch
   `visual/baselines-<short-sha>`.
2. Open a pull request, **"visual: N baselines changed on main"**, whose body links the
   failing run, the uploaded report artifact, and the tracking issue.
3. Open — or update, never duplicate — a tracking issue whose body links the pull request,
   the run, and the failing list.

The two reference each other in both directions. Merging the pull request means the change
was intended and is now the baseline. Closing it means a real regression, and the issue
stays open holding the evidence.

This replaces a ~40-minute local container loop (the working conditions section of
`docs/agents/visual-regression.md` documents why that loop is expensive and why the local
host is untrustworthy for this question) with a visual review of a diff.

## Decisions taken, with their costs

**The full sweep no longer runs on pull requests.** A regression whose shot is not selected
by the scoper reaches `main` before anyone sees it. Accepted: the nightly and the
post-merge sweep both catch it, and the recovery path above makes acting on it cheap.

**`release.yml` is not gated on Visual.** This was considered and declined. `release.yml`
chains off `workflow_run: Quality`, which completes in ~2 minutes; the full sweep takes ~7.
A visual regression that lands on `main` is therefore **published to the registry before the
sweep goes red**, and the remedy is a patch release forward rather than a held publish. This
is recorded as a decision, not an oversight: gating would add ~7 minutes of latency to every
publish and let a single flake stall releases. The registry is restricted, so the blast
radius of a bad version is internal.

**`quality.yml` is not touched.** Converting `pnpm test` to `nx affected -t test` was
considered and dropped as not worth the lift. It would save 20–30 seconds against a
2-minute job, and `build` cannot be converted alongside it in any case: `pretypecheck` runs
`nx run-many -t build` and root typecheck compiles the apps against every package's
`./dist/*` exports map, so affected-only builds would leave dists absent on a clean checkout
and break typecheck. `lint` and `format:check` are not Nx targets at all (`eslint .` at the
root), and scoping them to changed files risks missing cross-file rules.

**`visual-update.yml` stays.** It remains the right manual tool for a deliberate,
`--grep`-scoped regeneration, and the new jobs reuse its container setup rather than
duplicating it.

## Expected result

| event                                 | today                 | after                                                                     |
| ------------------------------------- | --------------------- | ------------------------------------------------------------------------- |
| pull request, docs page edited        | 8.5 min, 501 tests    | ~1.5 min, 2–4 shots                                                       |
| pull request, one component edited    | 8.5 min, 501 tests    | ~2 min, 30 tests (measured, Button)                                       |
| pull request, token change            | 8.5 min, 501 tests    | ~7 min, 501 tests — honestly                                              |
| pull request adding a component       | **13.8 min, 210 red** | ~7 min: 68 minted, 142 docs run (sidebar rule), red until `visual-accept` |
| pull request touching only `scripts/` | 8.5 min, 501 tests    | skipped, seconds                                                          |
| push to `main`                        | 8.5 min               | unchanged, 8.5 min                                                        |
| nightly                               | —                     | 8.5 min, new                                                              |

## Testing

- `scripts/visual-scope.test.mjs` — against fixture file lists, with the Nx call injected so
  the unit tests never shell out. Covers the mapping table, the unnarrowable fallback, the
  `run: false` case, the loud guard, and specifically:
  - **the sidebar fan-out rule** — an _added_ component file selects all docs shots, while a
    _modified_ one selects only its own. This is the regression test for the PR #88 finding
    and the single most important assertion in the file.
  - **pattern anchoring** — the emitted pattern for `Button` selects
    `components-button--primary` and not `components-dropdownmenu--with-button-trigger`, and
    no emitted pattern begins with `^`.
- `scripts/visual-missing.test.mjs` — missing-set computation against a fixture manifest and
  a fixture baseline directory, including the empty case.
- **A cross-check that the emitted patterns select what the scoper claims**, run against a
  real build: for a fixture change set, `playwright test --list --grep '<pattern>'` returns
  the expected count. The three anchoring facts above were established this way rather than
  from the Playwright docs, and a version bump could change them silently.
- End to end, on this branch: a pull request touching one docs page (expect a scoped run), a
  pull request adding a story with no baseline (expect an auto-mint commit **and** all docs
  shots via the fan-out rule), applying `visual-accept` to a pull request with a real diff
  (expect an accept commit), and a `workflow_dispatch` of the full sweep (expect no
  behaviour change).

## Documentation

`docs/agents/visual-regression.md` gains a section describing the new topology, the
`visual-accept` label, and the baselines-pull-request recovery. Its existing #65 diagnosis
procedure is unchanged and remains correct — that document is about diagnosing a flaky
baseline, which is orthogonal to where the suite runs.

It also gains the sidebar fan-out as a named fact, because it is the kind of thing that
costs an afternoon when rediscovered from a failing run: **adding a component fails every
docs baseline, and that is correct.** Anyone seeing 142 red docs pages on a
component-adding branch should be able to look that up rather than diagnose it.

A repository label `visual-accept` must exist for Component 3 step 4 to be selectable. It is
created as part of this work, with a description saying what it does.
