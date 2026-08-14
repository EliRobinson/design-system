---
'@elirobinson/ai-patterns': patch
---

Derive the brand skill's file inventory from what the tarball actually contains.

The consumer copies of `README.md` and `SKILL.md` listed the skill's files from
`BRAND_INDEX`, a hand-kept array in `src/artifacts/brand.mjs`. It named the four
`ui_kits/<kit>/` folders and missed `ui_kits/_shared/`, so every consumer
received `Primitives.jsx` — the file all four kits load over
`../_shared/Primitives.jsx` — with no document mentioning it, and a kit copied
out on the strength of the inventory rendered nothing.

The rows now come from the files the packer stages, at full depth.
`BRAND_DESCRIPTIONS` holds only the editorial one-liner per row, and the build
fails on a shipped folder with no row **and** on a row with no files behind it.
The check it replaces compared first path segments only, which is why `ui_kits`
being described four times over was enough to hide a fifth folder from it.
