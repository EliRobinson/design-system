---
'@elirobinson/ai-patterns': patch
'@elirobinson/tokens': patch
---

The brand boundary is enforced by a test, and four artifacts stop asserting one consumer as a rule of the system.

`docs/agents/brand-boundary.md` stated the rule; a rule documented only in prose is a rule
that drifts, which is how one consumer's price format, wordmark punctuation and product
line came to ship to every other consumer as the design system's own guidance.

`brand-boundary.test.mjs` asserts two things mechanically: no published artifact contains a
brand term outside a permitted file, and the permitted set is exactly the set the doc's
table names — double-entry, so neither side can move without the other.

It found four things on its first run. The corpus described the system as being "for
Miltinson Technologies products", in the first paragraph an agent reads. The three token
stylesheets carried a "Miltinson Technologies — Design Tokens" banner, where the system's
own name is Miltinson Design System. The `miltinson` palette's docblock named one
consumer's domain. And an email template's CTA pointed at that domain, which surfaced in
the shipped brand manifest.

The voice pack's own content still ships, labelled a default — permitted as a section
rather than by unguarding the artifacts that carry it.
