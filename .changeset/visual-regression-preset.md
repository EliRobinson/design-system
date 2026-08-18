---
'@elirobinson/ai-patterns': minor
---

Ship the visual regression suite as a preset instead of something to copy.

- New `@elirobinson/ai-patterns/testing/visual-config`: `defineVisualConfig` returns the
  determinism contract a screenshot suite has to hold — pinned clock, locale and timezone,
  `animations: 'disabled'`, exact pixel comparison (`threshold: 0`, and both diff budgets at
  zero), no retries, and `updateSnapshots: 'none'` so Playwright's default never quietly
  writes a baseline nobody asked for. `assertContainedBaselineUpdate` refuses
  `--update-snapshots` outside the pinned container, which is what stops a laptop's font
  rendering from becoming the baseline everyone else fails against. `use` and `expect` merge
  two levels deep, so setting one option there cannot silently drop the contract beneath it.
- New `@elirobinson/ai-patterns/testing/visual-sweep`: `sweepStorybook` and `sweepPages`
  register one test per subject per theme — theming, settling, caret suppression and the
  capture itself included — and `storybookStories` / `nextStaticRoutes` enumerate those
  subjects from a build's own `index.json` and prerender manifest. There is no list of
  components to snapshot anywhere, in this repo or a consumer's: adding a story or a page is
  all it takes to get a baseline.
- Both are plain `.mjs` with hand-written types, resolvable from CommonJS, and take
  Playwright's `test` and `expect` as arguments rather than importing them, so
  `@playwright/test` stays an optional peer.
