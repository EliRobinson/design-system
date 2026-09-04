---
'@elirobinson/ai-elements': patch
---

`NOTICE` now lists the `reduced-motion` rule, so its Apache-2.0 §4(b) modification list is
complete again.

The rule landed in the transform layer and really does modify
`src/components/conversation.tsx`, but `NOTICE` — which ships in the tarball and says its
list of modifications is "in full" — still named only four rules. That is a false §4(b)
statement in a published artifact, not a docs nit.

Nothing was generating or checking `NOTICE`; the standing docs claimed otherwise.
`scripts/ai-elements-layer.test.mjs` now asserts every id in the layer's `ruleIds` appears
in `NOTICE`, and re-reads the vendored `conversation.tsx` for `initial="instant"` and
`resize="instant"` so the motion patch cannot be deleted to force an upstream bump through
while three documents go on saying it is there.
