---
'@elirobinson/ai-patterns': patch
---

Ship the 13 mirrored font assets that `npm pack` was dropping.

`design-system-docs/fonts/` is a directory of symlinks into `packages/tokens/src/fonts/`, and `cpSync(..., { dereference: true })` only dereferences the copy _root_ — links met during the recursive walk were recreated as absolute, machine-specific links. `npm pack` drops a symlink pointing outside the package root, so all 13 font files were listed in `artifacts.json` and `brand-manifest.json` with valid hashes and absent from the tarball, and `ds-resync artifacts --write` failed with `ENOENT` on the first one.

The build now materialises symlinks at every depth, asserts with `lstatSync().isFile()` that every path in `artifacts.json` is a regular file, and a new test packs the tarball and checks each shipped entry against its recorded hash.
