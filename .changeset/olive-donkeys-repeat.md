---
'@elirobinson/ai-patterns': patch
'@elirobinson/tokens': patch
---

Stop the browser test suites failing on teardown alone.

`preflight-sweep.test.mjs` mirrored `playwright.test.mjs`'s browser bootstrap by
hand and lost two things in the copy: the explicit budget on `afterAll`, which
left `browser.close()` on Vitest's 10s default and failed the file roughly one
run in three under load with all four of its tests already passing, and the
loud skip, which meant a browser that never launched skipped the suite silently
and orphaned a late-arriving Chromium.

Both suites now boot from one `browser.test-helper.mjs`, which owns the budget
and registers the teardown itself, so a suite cannot forget it. The helper is
excluded from the published package. No consumer-facing behaviour changes; the
`@elirobinson/tokens` bump is a comment in `link-cascade.test.mjs` that pointed
at where the budget's reasoning used to live.
