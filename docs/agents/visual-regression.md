# Visual regression: diagnosing a baseline that passes locally and fails in CI

The suite compares screenshots at zero tolerance (`threshold: 0`, `maxDiffPixels: 0`) from a pinned container. That is what lets it catch a one-step colour shift. It also means any nondeterminism anywhere in the stack surfaces as a failing check rather than as noise you can ignore.

This is the procedure for the failure that costs the most time: **a baseline that passes where it was generated and fails in CI, by a small number of pixels, on a different set of pages each run.** Issue #65 spent about a day on one instance of it. The procedure below is roughly forty minutes.

Do these in order. Most cases stop at step 2.

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

| symptom                                                        | cause                                                                           | fix                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| page height differs by a pixel or two; everything below shifts | a length in `vw`/`%` landing on a fraction — `4vw` at 1280px is 51.2px          | quantise it: `round(4vw, 4px)` |
| 1–2 px on the corners of one element, one theme only           | `overflow` and `border-radius` on the same element, forcing a rounded clip mask | separate the two (see below)   |

The geometry case is the one #65 spent longest on, so it is worth stating what actually identified it. The differing pixels were always the corners of `pre.shiki`, and squaring those corners cleared 11 of 11 previously-flaky pages across two consecutive runs. Masking them cleared the same 11. Two independent interventions at the same place, same result.

The distinguishing feature of that element was not its radius — cards, buttons, inputs and the search field all have one and none of them flake. It was that the code block **also scrolled**. `overflow-x: auto` with `border-radius` on one element makes the renderer build a rounded clip mask, which is a different and more expensive path than filling a plain rounded rect. So the fix is to stop asking for both on one element: the wrapper takes the fill, border and radius, and the inner element keeps only the scrolling.

```css
/* the painted box */
.code-block__body {
  background: var(--bg-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
/* the scrolling box — no radius, nothing to clip against */
.code-block__body pre {
  overflow-x: auto;
}
```

Whatever you try, change one thing and give the rest a control group. Squaring the corner while leaving every other rounded element alone is what made "the arc" a finding rather than a guess.

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
- **`visual.yml` is advisory** (`continue-on-error`), so a red visual job does not block anything while you work. Note that this also means the workflow run reports success — read the job, not the run.
