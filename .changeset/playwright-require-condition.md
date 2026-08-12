---
'@elirobinson/ai-patterns': minor
---

Resolve `@elirobinson/ai-patterns/testing/playwright` from CommonJS, and declare
the Node floor that makes it work.

`./testing/playwright` exported only an `import` condition. Playwright compiles a
plain `.ts` spec to CommonJS, so the spec the README documents resolved through
`require` and died on `ERR_PACKAGE_PATH_NOT_EXPORTED` before a single assertion
ran. The only working form was a `.spec.mts` file, which nothing said.

The `require` condition points at the same `playwright.mjs` the `import`
condition does, rather than at a new CJS build. Nothing in the module needs
transpiling, it holds no state — every export is a pure function over a `page` —
so pointing both conditions at one file also rules out a dual-package split, and
`packages/ai-patterns` keeps shipping plain files. That leans on Node's
`require(esm)`, which needs the module to be free of top-level await (it is: the
one `await import('axe-core')` is inside `checkContrast`) and a runtime of 22.12
or newer — hence the new `"engines": { "node": ">=22.12.0" }`, which the package
previously left implied.

`playwright.exports.test.mjs` pins both halves: it resolves the subpath under the
`require` condition through Node's real export-map resolution, and it actually
`require()`s the module, so either deleting the condition or adding a top-level
await fails here rather than in a consumer's E2E suite.

The README example keeps its `.ts` filename — now accurate — and gains one line
naming the Node floor and the `.spec.mts` fallback below it.
