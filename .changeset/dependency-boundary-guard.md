---
'@elirobinson/ai-patterns': patch
---

A published file may not import a package its manifest never declared, and a test now says
so for every package in the workspace.

`dependency-boundary.test.mjs` reads what each `files` field actually resolves to and
fails on any import that is not a `dependency`, a `peerDependency`, an
`optionalDependency`, a Node builtin, a relative path or the package's own name. It goes
red on the 41 files `@elirobinson/react` was publishing before this release, which is what
it was written against.

The reading of `files` moved out of `brand-boundary.test.mjs` into
`published-files.test-helper.mjs`, shared by both suites rather than reimplemented. npm's
negation semantics are subtle enough — an interior `**` is an optional run of segments,
only a trailing one is greedy — that a second implementation would be a second chance to
get them wrong in the direction that fails by passing, which is the drift #214 was about.
Neither file is published: the `.test-helper.mjs` suffix is already excluded by this
package's `files`.
