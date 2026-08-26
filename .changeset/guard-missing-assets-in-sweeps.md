---
'@elirobinson/ai-patterns': minor
---

Every sweep now fails a shot whose page could not load one of its own assets.

A pixel comparison structurally cannot catch a missing asset. A file the server
does not have renders as a stable empty box, and a stable empty box compares
equal to itself on every future run — so the moment a baseline records the empty
state, the suite is green and wrong permanently, with nothing left to report it.
This repo came within one run of exactly that: five `/brand` routes rendered in a
job that never received `apps/docs/public/brand`, and the only reason it surfaced
as a failure rather than a recording was that a correct baseline happened to have
been minted first, by a differently-shaped job.

`sweepPages`, `sweepStorybook` and `sweepChrome` now watch the network for
same-origin responses of 400 or above and fail the shot before the screenshot is
taken. Before, not after: CI mints a baseline for any shot that does not have
one, so a check that ran after the capture would still let a first-shot route
record its broken state as truth — which is the case worth preventing.

Same-origin only, measured against `baseUrl`. A blanket rule would fail a suite
whenever a third-party host a page legitimately reaches had a bad minute, which
is a flake rather than a defect. Any status at or above 400 rather than 404
alone, since a 500 paints the same empty box. Requests that fail without
producing a response are deliberately not checked: a framework aborts its own
route prefetches, and a genuinely absent file answers with a real status.

A request expected to fail can be named in the new `allowMissing` option, as a
substring or a `RegExp`. A page object that cannot be subscribed to is a hard
error rather than a skipped check — a sweep that passes while watching nothing
is indistinguishable from one with no missing assets, which is the failure this
whole guard exists to make impossible.
