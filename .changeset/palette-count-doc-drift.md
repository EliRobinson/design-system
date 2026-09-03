---
'@elirobinson/tokens': patch
---

Corrects comments in `palettes.css` that still described two palettes and four blocks. A
third palette — `miltinson`, teal over indigo — shipped in `f549d48`, so the header's
block list, its specificity walkthrough and the "Adding a palette" note were all counting
wrong. The list now names all six blocks and the surrounding prose is phrased per palette
rather than by a fixed count, so the next palette does not re-introduce the same drift.

No value, selector or measured ratio changes. `palettes.css` ships in the tarball via
`files: ["src", …]`, which is why a comment-only fix is a patch rather than an empty
changeset.
