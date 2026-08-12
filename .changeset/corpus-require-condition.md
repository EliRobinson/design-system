---
'@elirobinson/ai-patterns': minor
---

Resolve `@elirobinson/ai-patterns/corpus` from CommonJS, and declare the Node
floor that makes it work.

`./corpus` exported only an `import` condition — the same latent bug
`./testing/playwright` had, found while fixing that one and left out of scope
there. The caller that renders its own `llms.txt` from its own manifest is a
build script, and a build script in a `"type": "commonjs"` repo is a plain `.js`
file, so it reaches this subpath through `require` and died on
`ERR_PACKAGE_PATH_NOT_EXPORTED` at resolution, before `llmsIndex` was ever
called. The only working form was `.mjs`, which nothing said — and a subpath a
consumer has to be told how to import is prose we made them write.

The `require` condition points at the same `llms.mjs` the `import` condition
does, rather than at a new CJS build. The module imports nothing at all and
holds no state — every export is a pure function of its arguments — so pointing
both conditions at one file also rules out a dual-package split, and
`packages/ai-patterns` keeps shipping plain files. That leans on Node's
`require(esm)`, which needs the module to be free of top-level await (it is,
across an empty dependency graph) and a runtime of 22.12 or newer — hence the
new `"engines": { "node": ">=22.12.0" }`, which the package previously left
implied.

`llms.exports.test.mjs` pins both halves: it resolves the subpath under the
`require` condition through Node's real export-map resolution, and it actually
`require()`s the module, so either deleting the condition or introducing a
top-level await fails here rather than in a consumer's build.
