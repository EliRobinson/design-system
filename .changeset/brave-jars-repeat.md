---
'@elirobinson/ai-elements': minor
'@elirobinson/ai-patterns': patch
---

Vendored AI Elements now meets this system's touch-target and focus contracts, and
`checkFocusVisible()` no longer reports a false violation on a control that already had
focus.

**The audit.** All four browser-settled contracts —
`checkTouchTargets`, `checkHitAreaOverlap`, `checkFocusVisible`, `checkContrast` — were
run over all 48 vendored components in both themes, all three palettes and both platform
settings: 576 measurements. The baseline found 61 controls below the 44x44 floor across 39
components, 2 focus-visible reports, 0 hit-area overlaps, and 24 contrast findings.

**Touch targets.** shadcn/Radix draws controls at 32-40px, which clears WCAG 2.2 AA
(SC 2.5.8, 24x24) and misses this system's 44x44 default, which is AAA (SC 2.5.5). Every
affected control was classified individually against one of the two floors —
17 primary, 11 dense — and the verdicts are published, with the geometry that was measured
and the reason each is not the other, in `contracts.json` under `vendoredElementTargets`.
`ds contracts` prints them. Nothing is exempted from measurement: a dense control is held
to `var(--target-min)` (24x24) and reported under `touch-target-dense` if it misses.

The default is the strict floor. `ui/button.tsx` carries a
`not-data-[touch-target=dense]` guarded `var(--target)` minimum, so a control nobody has
classified is measured strictly rather than quietly excused, and each relaxation is a named
entry with an argument attached. Two controls were below the dense floor as well and had no
tier to fall back into: the dialog's close button at 16x16, whose hit area now grows around
an unchanged 16px glyph, and the citation rows in `sources.tsx` at 16px tall.

Applied through a new, single-purpose rule in the transform layer
(`scripts/ai-elements-patches/a11y.mjs`), so no vendored file is hand-edited and every
change stays attributable across an upstream bump. Its anchors are exact and a miss is
fatal: `pnpm sync:elements` stops and names the control rather than dropping the fix and
reporting a clean bump. `NOTICE` gains the matching Apache-2.0 §4(b) paragraph.

**`checkFocusVisible()` fix, which is not specific to Elements.** A control that already
held focus when the sweep reached it was snapshotted in its focused state, so `.focus()`
changed nothing and its perfectly good focus ring was reported missing. Radix's Dialog
moves focus to its close button on open, so every open dialog on any page produced one of
these. The check now blurs such a control before taking the `before` snapshot, in both the
programmatic and the keyboard branch. This is the mirror of the inert-control guard the
function already had: a probe that could not run must not be reported as a result.

**Colour is unchanged and is not fixed here.** The sweep left 24 contrast findings, all in
dark theme, all owned by the token bridge rather than by this package. 20 of them trace to
one cause: `@elirobinson/tokens/tailwind.css` declares no `@custom-variant dark`, so
Tailwind's default `dark` variant does not match this system's `[data-theme="dark"]` dial
and all 89 `dark:` utilities in the vendored tree are inert — including the ones that swap
syntax highlighting to its dark theme, which is why highlighted code measures as low as
1.43:1 on a dark surface. They are gated, not ignored: the audit spec fails on a contrast
finding anywhere else, and also fails when a listed one is fixed, telling you to delete the
entry.

**Runnable.** `pnpm a11y:elements` builds the package, builds the harness and runs the
sweep. The component roster comes from `@elirobinson/ai-elements/manifest`, so a component
a future upstream release adds arrives in the sweep by itself and arrives failing rather
than unnoticed.
