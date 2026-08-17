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

It is also the only honest way to confirm a fix. After the fix, the same commit run twice gave **identical sets, 91 and 91, zero difference**. Two runs before, two after; that is the whole experiment.

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

Record the failures by theme. A lopsided split is a strong signal, and it points at colour rather than timing or load. In #65 it was **23 failures across four runs, every one light, not one dark** — which ruled out the load-related explanations that local investigation kept producing.

When one theme flakes and the other does not, measure the gap between the two colours meeting at the antialiased edge:

|       | border                     | background         | gap           |
| ----- | -------------------------- | ------------------ | ------------- |
| light | `rgb(229,231,234)`         | `rgb(241,243,244)` | **12 levels** |
| dark  | `rgb(245,255,255)` @ α 0.1 | `rgb(4,6,8)`       | 241 levels    |

A narrow gap is the tell. The corner blends across that band, so the blended byte is decided in the last bit, and two builds of Skia that agree to a float epsilon still round it differently.

---

## 5. Identify what the value is computed _from_

Both root causes found so far are the same shape: **a value the rasteriser derives at paint time from something that is not already an exact device unit.**

| symptom                                                        | cause                                                                                                     | fix                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| page height differs by a pixel or two; everything below shifts | a length in `vw`/`%` landing on a fraction — `4vw` at 1280px is 51.2px                                    | quantise it: `round(4vw, 4px)`            |
| 1–2 px on antialiased edges, one theme only                    | a colour in `oklch()`, converted through `lab()` to sRGB at paint time — cube roots and a matrix multiply | pin it to the sRGB it already resolves to |

For the colour case, compute the target analytically and confirm it against the browser's resolved value before pinning, so the change is provably byte-identical for solid fills:

```js
// oklch(96.2% 0.003 247) -> rgb(240.791, 242.572, 244.299) -> #f1f3f4
```

Pin the specific tokens involved, not the whole ramp. Leaving the rest untouched gives the next CI run a control group.

---

## What not to do

Each of these was tried on #65 and made things worse or hid the problem:

- **Do not raise `maxDiffPixels` to absorb it.** The flake reached ~1200px under emulation and a Badge's entire fill is ~1400px. A budget wide enough to steady the suite is wide enough to hide the regression class it exists to catch. A green, hollow suite is worse than one that needs a re-run.
- **Do not raise `expect.timeout`.** The same budget governs retries on failure. Going 20s → 60s let one failing comparison monopolise the machine and roughly **quadrupled** the flake rate.
- **Do not add workers to speed up diagnosis.** Serial → 3 workers took a run from 1 failure to 18. Contention is the largest single amplifier.
- **Do not regenerate repeatedly and hope.** If the cause is nondeterminism, regenerating produces baselines that pass where they were made and fail where they are checked. #65 burned three ~30-minute cycles this way.
- **Do not trust a local pass as a prediction of CI.** Baselines generated on an emulated arm64 host can be systematically wrong for a native amd64 runner — two Storybook stories failed CI by identical deltas on every run while regenerating byte-identical locally.

---

## Working conditions

- **`pnpm test:visual` on the host is a pre-flight, not a check.** It cannot write baselines by design, so every comparison fails identically on a missing snapshot — which makes hangs and structural breakage stand out in about two minutes instead of forty.
- **A full container regeneration is ~30 minutes.** Do not start one casually, and do not start one while someone else is committing rendering changes to the same checkout: #65 lost three runs to commits landing mid-flight. Record the SHA at start and compare it at finish.
- **CI is ~8 minutes and runs the image natively.** For any question about determinism it is both faster and more trustworthy than the local container. Reach for a rerun before reaching for a regeneration.
- **`visual.yml` is advisory** (`continue-on-error`), so a red visual job does not block anything while you work. Note that this also means the workflow run reports success — read the job, not the run.
