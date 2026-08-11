---
'@elirobinson/ai-patterns': patch
---

Add a drift test for the published `testing/playwright` type surface.

`src/testing/playwright.mjs` is plain JavaScript typed by a hand-written
`playwright.d.ts`, and `./testing/playwright` publishes both as `types` and
`import`. Nothing checked that the two agreed, so a rename or a new helper could
leave the declarations describing a module that no longer exists — invisible in
this repo, and surfacing only when a consumer's test suite compiles against the
lie.

`playwright.types.test.mjs` compares the module's real runtime exports against
the value declarations parsed out of the `.d.ts` in both directions, and names
the specific export that drifted in the failure message. No new dependencies.
