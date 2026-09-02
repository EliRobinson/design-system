---
'@elirobinson/react': patch
---

The published tarball no longer carries this package's test suite or its test harness.

`files` was `["dist", "src", "CHANGELOG.md"]` — the one manifest in the repo with no
negations — so every `*.test.tsx` and the whole of `src/test/` shipped to the registry.
Measured with `npm pack --dry-run`: 414 files, 41 of them tests, 193 KB of 1046 KB
unpacked. It is now 373 files and 852 KB, and the 41 removals are exactly the 37 test
files and the four harness modules; nothing else changed.

Beyond weight, those files imported `vitest`, `@testing-library/react` and
`@testing-library/user-event`, none of which is a dependency or a peerDependency here. A
bundler resolving an explicit subpath never saw them; a `tsc` with `skipLibCheck: false`,
a typescript-eslint project service or an IDE indexing `node_modules` did, and could not
resolve them. `src/test/consumerReset.ts` also read as something published for consumers
to use — it is a jsdom stub for two of this package's own suites.

Nothing a consumer can reach was removed: no entry in `exports` names any of these paths,
and no shipped source file imports them.
