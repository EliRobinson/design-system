---
'@elirobinson/ai-patterns': minor
---

`defineVisualConfig` budgets 8 differing pixels for rasteriser nondeterminism, and keeps `threshold: 0`.

The container pins software, not the host CPU. Skia's rasterisation of anti-aliased curves and glyph edges is not bit-identical across GitHub's runner fleet, and the measured case (issue #125) was a sweep going red on a commit that changed only `package.json` and `CHANGELOG.md` — 42 pixels differing byte-for-byte on two avatar arcs, 3 of them counted by the comparator, from a container digest identical to the passing runs either side of it.

`threshold` stays at 0: a colour tolerance is what would hide a one-step shift inside a token ramp, and it is not on the table. The pixel budget is a different lever — a token-ramp shift, a spacing change, a font swap or a layout regression each move thousands of pixels and still fail at 8.

`maxDiffPixelRatio` is now left unset rather than 0. Playwright resolves the two budgets with `Math.min`, so a ratio of 0 alongside `maxDiffPixels: 8` would have cancelled the budget back to 0 and made this change a no-op.

Minor rather than patch: this is not a bug fix, it changes a shipped default in a way a consumer's suite will feel. A suite built on this preset now tolerates up to 8 differing pixels per shot where it previously tolerated none, and that is worth a version bump someone notices in a changelog. Overriding it is unchanged — `expect.toHaveScreenshot` still merges two levels deep, so `{ expect: { toHaveScreenshot: { maxDiffPixels: 0 } } }` restores the old behaviour and keeps the rest of the contract.
