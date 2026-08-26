---
---

Nothing published changes. `nx.json` gives the `test` targetDefault
`dependsOn: ["^build", "build"]`, and
`packages/ai-patterns/src/artifacts/pack-integrity.test.mjs` stops discarding the
stderr of the two commands it shells out to — a test file, kept out of the
tarball by `!src/**/*.test.mjs`.

#147 put `build` and `test` in one `nx affected` graph. The `test` targetDefault
declared only `{"cache": true}` and no project.json made a `test` wait on its own
`build`, so `ai-patterns:test` could pack a `dist/artifacts` that
`ai-patterns:build` was still writing. apps/docs and packages/design-system-mcp
were never exposed: both already declare `dependsOn: ["^build"]` themselves.

Empty rather than a patch because a consumer installing this version gets
byte-identical files.
