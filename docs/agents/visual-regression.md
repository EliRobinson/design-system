# Visual regression: diagnosing a baseline that passes locally and fails in CI

The suite compares screenshots at zero tolerance (`threshold: 0`, `maxDiffPixels: 0`) from a pinned container. That is what lets it catch a one-step colour shift. It also means any nondeterminism anywhere in the stack surfaces as a failing check rather than as noise you can ignore.

This is the procedure for the failure that costs the most time: **a baseline that passes where it was generated and fails in CI, by a small number of pixels, on a different set of pages each run.** Issue #65 spent about a day on one instance of it. The procedure below is roughly forty minutes.

Do these in order. Most cases stop at step 2.

---

## Where the suite runs, and how to get back to green

| trigger                                       | job(s)                                                                  | what runs                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| pull request opened, synced, or reopened      | `scoped`                                                                | only the shots the change could have altered, plus any shot that has no baseline yet                    |
| `visual-accept` label added to a pull request | `scoped` — a fresh run, since adding the label is itself a trigger      | the same scoped comparison, then regenerates and commits exactly the shots that failed                  |
| push to `main`                                | `full`, then `recover` if it goes red                                   | the full sweep, 501 tests                                                                               |
| nightly, 06:00 UTC                            | `full`, then `recover` if it goes red                                   | the full sweep                                                                                          |
| `workflow_dispatch`                           | `full` (`recover` only fires if the ref is `main` and the sweep failed) | the full sweep — this dispatch takes no `--grep` input; use `visual-update.yml` for a scoped manual run |

Any other label added to a pull request also re-triggers `scoped` — GitHub's `labeled` event can't be filtered to one label name in the workflow's `on:` block, so the job itself checks `github.event.label.name == 'visual-accept'` and no-ops for anything else. Worth knowing before you debug it twice: **adding any label cancels whatever scoped run is already in flight**, because the workflow-level `concurrency` group is evaluated before the job's `if:` — a `wip` or `needs-triage` label restarts the run and then does nothing with it.

**A new shot is minted automatically, on the pull request branch.** The `scoped` job runs `scripts/visual-missing.mjs`, and for anything with no baseline runs Playwright with `--update-snapshots=missing` and commits the result before the comparison even starts. This can only ever _create_ a baseline — Playwright's `missing` mode refuses to touch a shot that already has one — so it cannot launder a regression into an accepted baseline. A component-adding pull request no longer needs a manual `visual-update` dispatch for its new shots.

**Overwriting an existing baseline needs the `visual-accept` label, and the label accepts once.** That separation is the whole point: minting is automatic and can only create, accepting is opt-in and can overwrite. Add the label and the workflow starts a new run on its own — there is no need to re-run the job by hand. On that run, `scoped` regenerates exactly the shots that failed (`scripts/visual-failures.mjs` reads them from `test-results/report.json`) and commits them as `test(visual): accept N baselines`.

The Accept and Report steps both key off `github.event.action == 'labeled'`, not off whether `visual-accept` is present on the pull request — so the label fires an accept only on the run where it was just applied, never on a later run where it merely happens to still be attached. Push again after that — even something unrelated to the shots that were just accepted — and if anything fails, `scoped` goes red and reports it instead of silently accepting: the label is still sitting on the pull request, but this run's `github.event.action` is `synchronize`, not `labeled`. **To accept a second time on the same pull request, remove the label and re-add it** — the re-add is itself a fresh `labeled` event and starts another run, exactly like the first accept. That round-trip is deliberate, not friction to route around: testing for the label's mere presence, the way this used to work, would let one approval on day one silently launder every regression pushed on day two into an accepted baseline.

**A red sweep on `main` opens its own recovery, split across two jobs.** The Playwright container ships `git` but not the `gh` CLI, so `full` (inside the container) does the mechanical half — rerun with `--update-snapshots=changed` against just the failing shots, upload the result as an artifact — and a separate, container-less `recover` job downloads that artifact, commits it to a `visual/baselines-<short-sha>` branch, and opens the pull request and the tracking issue. The tracking issue is found by a dedicated `visual-baseline` label, not the general `visual` label — `visual` is also what a human would naturally put on issue #65 itself, and a collision there would mean the recovery path finds #65 forever and never opens a real issue. Merging the pull request closes the issue automatically, via a `Closes #<N>` line in its body.

**If the regeneration changes nothing, that's a flake, not a regression.** `full` reruns the failing shots to regenerate them; if that rerun produces byte-identical output, nothing was actually wrong with the baseline — the failure was #65's flake reproducing itself. No pull request or issue opens for it. The job stays red, so the flake is still visible, and its summary points here — specifically at step 2 below ("run the identical commit twice"), which is the right procedure for exactly this shape of failure.

**A `workflow_dispatch` red sweep off `main` doesn't open a recovery either** — `recover` only ever targets `main`, since that's the only branch its pull request could be based against. The job summary names the fix instead: `gh workflow run visual-update.yml --ref <branch> --field grep=<pattern>`.

**A fork's pull request is refused before it runs anything.** `GITHUB_TOKEN` can't push to a fork's branch, so every mint, accept, and commit step in `scoped` would fail partway through. The job checks this first and fails fast with the same `visual-update.yml --ref ... --field grep=...` remedy.

### Adding or removing a component fails every docs baseline, and that is correct

`apps/docs/src/lib/site-map.ts` builds one page registry, and the sidebar, the header nav, the homepage cards, and the command palette all derive from that registry — not from the manifest directly. Only the Components sections of the registry come from the generated component manifest; Foundations, Patterns, and Guidelines come from the `page.mdx` files on disk instead (see `derivedSection()` in that file). Either source feeds the same registry, and the sidebar renders on every docs page. So **adding or removing a component changes every docs shot**: measured on PR #88, which added six components (ChatMessage, ChatThread, DecisionCard, StreamingCaret, StubCard, VerdictBadge), all 142 pre-existing docs-wide screenshots failed comparison, and zero stories did.

This is why `scripts/visual-scope.mjs` treats an added or deleted component file — and an added or deleted docs page file, and any change to `site-map.ts`, `manifest.ts`, the `(docs)` layout, `SiteHeader`, or `site.css` — as a docs-wide event rather than narrowing to that component's own page. Narrowing there would produce a green pull request and 142 stale baselines on `main`. A _modified_ component file doesn't trigger this: the registry is unchanged, so the sidebar is unchanged, and narrowing to that component's own shots stays safe.

**Editing** a page under `foundations/`, `patterns/`, or `guidelines/` is a docs-wide event too, unlike editing a component page. Those three sections are the derived ones: `derivedSection()` reads each page's own `metadata.title`, `navTitle`, and `order` off disk to build the sidebar entry, so retitling or reordering one page moves an entry that renders on all 142. A component page carries no such metadata — its sidebar entry comes from the generated manifest — so editing one stays narrowed to that page.

`design-system-docs/` is a docs-wide event as well, and one Nx cannot see: the directory belongs to no project, so `nx show projects --affected --files=design-system-docs/…` answers `[]`. It is read at build time to generate `brand-manifest.json`, which becomes the UI Kits sidebar section on every docs page and the content of the `/brand/*` shots. The scoper forces the `docs` side whole for it, the same way it does for `playwright.config.ts`. The general rule to check any new path against: **a path Nx cannot map is a path the scoper cannot see** — if it can change a pixel, it has to be named in `visual-scope.mjs`.

Meeting 142 red docs pages on a component-adding branch is expected, not a break — but see the next section: `docs-wide` is currently disabled precisely because "expected, not a break" still costs a 14-minute run and a label on every component PR.

### Why `docs-wide` is disabled

`docs-wide` is commented out in `playwright.config.ts` and its 142 baselines are deleted. `docs-narrow`, `storybook-wide` and `storybook-narrow` all still run.

The reason is the section above. Because the sidebar renders on every docs page and derives from one registry, a single added component invalidates all 142 shots at once. That is not a bug in the scoper — the scoper is right to force the docs side whole — but it means the project is reliably red on exactly the pull requests this system exists to protect, and the signal is one bit ("the sidebar moved") repeated 142 times. The storybook projects, which isolate a component's own rendering, caught zero false positives across the same change and are where the real regression signal lives.

Re-enable when **both** are true:

- **A. A scoping answer that survives a sidebar change.** Options worth weighing: screenshot the page's content region rather than the full page; stub the registry to a fixed fixture set so the sidebar is invariant; or mask the sidebar in the comparison. Each trades some coverage for a signal that means one thing.
- **B. Sharding and a CI matrix.** 142 wide-viewport page shots is the bulk of the suite's runtime. Sharded across a matrix it fails in minutes rather than 14, which is what makes a re-run cheap enough that a noisy project is tolerable in the first place.

To re-enable, uncomment the `docs-wide` block in `playwright.config.ts`. Nothing else changes: `docs-wide` is deliberately still in `SPEC_FILE_BY_PROJECT`, and the mint step in `visual.yml` regenerates the baselines on the runner automatically on the first pull request that runs it. Do not regenerate them locally — see the top of this file for why the host is the variable.

---

## 1. Establish what kind of failure it is, by size

Run `pnpm visual:diff` on the artifact Playwright uploaded:

```bash
pnpm visual:diff test-results/output/<test-dir>/<name>-expected.png test-results/output/<test-dir>/<name>-actual.png
```

Read the first line only:

| output                                                   | meaning                                       | go to            |
| -------------------------------------------------------- | --------------------------------------------- | ---------------- |
| `size differs … height ±N`                               | a layout shift; everything below it "differs" | step 5           |
| `differing=` in the thousands                            | something genuinely repainted                 | regenerate, done |
| `differing=` under ~50, `largest channel delta=1` or `2` | subpixel nondeterminism                       | step 2           |

The pixel _count_ is misleading on its own and the diff image is worse — a 0.8px layout shift and a re-rasterised font both look like "the whole page went red". The coordinates are the diagnosis, which is why this ships as a command rather than an eyeballing exercise.

---

## 2. The one measurement that matters: run the identical commit twice

**Before diagnosing anything, re-run CI on the unchanged commit and compare the two failure sets.** Nothing else you do is interpretable until you know which of these you have:

- **Same set both times** → the baselines are simply stale. Regenerate them (`pnpm test:visual:update`), commit, done. Not a flake, whatever it looked like.
- **Different set** → genuine nondeterminism. Continue to step 3.

```bash
gh run rerun <run-id>
# then diff the two failure lists
```

Skipping this is the single most expensive mistake available here. In #65 the failing set changed between runs that also had different code _and_ different baselines, so "the set reshuffles" was an inference, and it was read backwards twice — once as a stale-baseline problem, once as a systematic cross-architecture difference. One rerun of an unchanged commit settled it in eight minutes: 7 failures, then 3, with **zero overlap**.

### The trap: this comparison only works on fresh baselines

**Comparing failure sets tells you nothing about pages that were going to fail anyway.** If a page's baseline is stale — you changed a colour, a radius, a length — it fails on every run regardless of whether the flake also hit it. Set membership cannot move, so the comparison comes back identical and looks like proof.

#65 fell in exactly this hole. A token change was made, the same commit was run twice against the _old_ baselines, both runs failed the same 91 pages, and that was written up as the fix confirmed. It confirmed nothing: those 91 were failing on the deterministic delta between old baselines and new colours, and a 1-pixel flake on top of a guaranteed failure is invisible. The flake was still there, and showed up the moment the baselines were regenerated.

So the order is not optional:

1. **Regenerate the baselines of the pages you are testing** — scoped, with `--grep`, not the whole sweep.
2. **Then** run the same commit twice and compare.
3. Read _only_ the pages with fresh baselines. Everything else is noise by construction, however deterministic it looks.

A page that fails in both runs at a stable pixel count is not flaking — see step 6.

---

## 3. Find the element, do not guess it

Coordinates have structure. Print them and look for it:

- The same coordinates on many different pages → shared chrome, not the component the page is named after.
- `x` stepping out and back over a short `y` run (e.g. 1142 → 1143 → 1143 → 1142) → **the arc of a rounded corner**.
- A tight cluster on one row → a glyph run or a border edge.
- Pages that fail by exactly two pixels are the most informative ones you have: two pixels is usually two corners of one box.

Then name it, rather than reasoning from the layout:

```js
// with the docs site served and the viewport at the baseline's width
document.elementFromPoint(1142, 302);
```

Check `getBoundingClientRect()`, `borderRadius`, `borderColor` and `backgroundColor` on what comes back.

---

## 4. Check whether the two themes disagree

Record the failures by theme. A lopsided split is a strong signal: it rules out timing and machine load, which hit both themes equally. In #65 it was **23 failures across four runs, every one light, not one dark** — which killed the load-related explanations local investigation kept producing.

What the asymmetry tells you is **where the instability is visible, not what causes it.** Measure the gap between the two colours meeting at the antialiased edge:

|       | border                     | background         | gap           |
| ----- | -------------------------- | ------------------ | ------------- |
| light | `rgb(229,231,234)`         | `rgb(241,243,244)` | **12 levels** |
| dark  | `rgb(245,255,255)` @ α 0.1 | `rgb(4,6,8)`       | 241 levels    |

A narrow gap is the tell — but read it correctly. The edge blends across that band, so the blended byte is decided in its last bit and a hair of difference flips it. Widen the gap and the same instability is still there; it just lands inside a step and stops being visible.

This distinction cost #65 a full cycle. The narrow gap was read as _the cause_, the two colours were pinned to exact sRGB to remove the `oklch` → `lab` conversion at paint time, and it changed nothing: the flake came back at the same coordinates the moment the baselines were regenerated. Colour told us which theme shows the problem. It did not tell us what the problem was.

---

## 5. Identify what the value is computed _from_

| symptom                                                        | cause                                                                                            | fix                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------- |
| page height differs by a pixel or two; everything below shifts | a length in `vw`/`%` landing on a fraction — `4vw` at 1280px is 51.2px                           | quantise it: `round(4vw, 4px)`         |
| 1–2 px on the corners of one element, one theme only           | the antialiased arc of a `border-radius`, where the two colours meeting at it are close together | remove the radius, or mask the element |

The geometry case is the one #65 spent longest on. What is established is narrow, and worth keeping narrow:

- The differing pixels were always the corners of `pre.shiki`.
- **Squaring** those corners cleared 11 of 11 previously-flaky pages across two consecutive runs.
- **Masking** them cleared the same 11.

Two independent interventions at the same place, same result. That is the finding: the arc is where it happens, and removing it or hiding it both work.

**What is _not_ established is why that element and not others**, and the record here is a warning. The reasoning "cards, buttons and inputs all have a radius and do not flake, so the distinguishing feature must be that the code block also scrolls" was tested: the radius was moved to a non-scrolling wrapper, leaving the `<pre>` with only `overflow-x`. **It still flaked** — three of twelve pages in one run, two in the next, different sets. The scrolling was never the factor, and that hypothesis cost a full cycle. Reverted.

So do not go looking for a clever structural cause. Reach for the two interventions that have been measured, and pick between them on design versus coverage:

- **Square the corners.** Removes the instability at source and keeps the element under comparison. Changes how it looks.
- **Mask the element.** Keeps the design; stops comparing that element's border, radius and background entirely.

Whatever you try, change one thing and give the rest a control group — and hold the result to step 2's rule, or you will confirm something that did not happen.

---

## 6. Rule out the second bug class before blaming the code

Not every CI-only failure is a flake. There is a second, quieter class:

**A page that fails CI at a stable pixel count on every run, and regenerates byte-identical in the local container.** That is not nondeterminism. It is the local container and the runner rendering the page differently — an amd64 image emulated on an arm64 Mac against the same image running natively.

No CSS change touches these. In #65, `/components/date-picker · light` failed identically under three separate configurations — squared corners, masked, and the overflow split — because none of them had anything to do with it. `/patterns/sidebar · light` and two Storybook stories behave the same way.

The tell is stability. Flake moves between runs; this does not.

The fix is not in the page, it is in where the baseline came from: regenerate on the runner via the **Visual update** workflow (`.github/workflows/visual-update.yml`), which dispatches manually and takes the same `--grep`. Chasing one of these locally is unbounded work, because the machine you would be fixing it on is the one causing it.

---

## What not to do

Each of these was tried on #65 and made things worse or hid the problem:

- **Do not raise `maxDiffPixels` to absorb it.** The flake reached ~1200px under emulation and a Badge's entire fill is ~1400px. A budget wide enough to steady the suite is wide enough to hide the regression class it exists to catch. A green, hollow suite is worse than one that needs a re-run.
- **Do not raise `expect.timeout`.** The same budget governs retries on failure. Going 20s → 60s let one failing comparison monopolise the machine and roughly **quadrupled** the flake rate.
- **Do not add workers to speed up diagnosis.** Serial → 3 workers took a run from 1 failure to 18. Contention is the largest single amplifier.
- **Do not regenerate repeatedly and hope.** If the cause is nondeterminism, regenerating produces baselines that pass where they were made and fail where they are checked. #65 burned three ~30-minute cycles this way.
- **Do not trust a local pass as a prediction of CI.** Baselines generated on an emulated arm64 host can be systematically wrong for a native amd64 runner — two Storybook stories failed CI by identical deltas on every run while regenerating byte-identical locally.
- **Do not declare a fix confirmed from a comparison that could not have failed.** See the trap in step 2. If the pages you are reading were going to fail anyway, an identical result across two runs is arithmetic, not evidence. Ask what result would have falsified the claim; if there isn't one, the test is worthless.
- **Do not regenerate the full sweep to test a hypothesis.** `--grep` a handful of the failing pages instead: ~5 minutes against ~30, and CI reads the same either way. Regenerate everything once the fix is proven, not while you are still guessing.

---

## Working conditions

- **`pnpm test:visual` on the host is a pre-flight, not a check.** It cannot write baselines by design, so every comparison fails identically on a missing snapshot — which makes hangs and structural breakage stand out in about two minutes instead of forty.
- **A full container regeneration is ~30 minutes.** Do not start one casually, and do not start one while someone else is committing rendering changes to the same checkout: #65 lost three runs to commits landing mid-flight. Record the SHA at start and compare it at finish.
- **CI is ~8 minutes and runs the image natively.** For any question about determinism it is both faster and more trustworthy than the local container. Reach for a rerun before reaching for a regeneration.
- **`visual.yml` reports honestly.** `scoped` and `full` each wrap only their comparison _step_ in `continue-on-error: true` — not the job — so a later step can still run after a red comparison: `scoped`'s accept-and-commit step, or `full`'s regenerate-and-upload step. On a red `check`, `scoped` runs exactly one of two mutually exclusive steps: "Accept the changed baselines" if `github.event.action == 'labeled'` — THIS run is the one where `visual-accept` was just applied, not merely a run where the label is sitting on the pull request — or "Report the failing shots", which ends the job with `exit 1`, on every other action. The Accept step is not a guaranteed route to green: it exits non-zero itself if `scripts/visual-failures.mjs` lists no failing shot (the check failed for a reason with no baseline to accept — a crash or a build break) or if regenerating the failing shots produces no change on disk (the check failed for a reason accepting can't fix). So a `labeled` run can still end red — a red `scoped` job is not proof the label failed to apply. `full` has an explicit "Fail the job" step for the same red-job guarantee. A red job is a red job. Nothing on `main` is branch-protected, so this changes what you see, not what merges.
