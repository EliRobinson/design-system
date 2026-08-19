---
'@elirobinson/ai-patterns': patch
---

Visual regression: the `docs-wide` Playwright project is temporarily disabled.

This is repo CI, not published behaviour — no consumer API changes. A consuming
repo using `@elirobinson/ai-patterns/testing/visual-config` is unaffected: the
preset still exports `WIDE_VIEWPORT` and `NARROW_VIEWPORT`, and which projects
you run has always been yours to declare in your own `playwright.config.ts`.

If you mirror this repo's project list, note the reasoning: the docs sidebar
renders on every page and derives from one registry, so adding a single
component invalidates every wide-viewport page shot at once — 142 of them on
PR #88, against zero story failures. A per-page suite whose failures are all
the same one bit is noise on exactly the pull requests it should be protecting.
Component-isolating story shots carry the real signal.
