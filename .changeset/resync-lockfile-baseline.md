---
'@elirobinson/ai-patterns': minor
---

Measure `ds-resync` staleness against the lockfile, and report an out-of-sync `node_modules` as its own finding.

`ds-resync` decided whether a repo was current by comparing `node_modules`
against the registry. It never read the lockfile. When an install had drifted
ahead of the committed manifests, the tool reported the repo as nearly current
while the state CI and a fresh clone actually build was many versions behind —
silently, with no indication that the two sources disagreed.

Observed in a consuming repo: `package.json` asked for `@elirobinson/react`
`^1.3.0`, the lockfile held 1.3.0, and `node_modules` held 2.0.1. `ds-resync`
printed "1 package behind: @elirobinson/ai-patterns 0.9.0 → 0.9.2 (patch)". The
truth was four packages behind, including a major on `react`.

**What the tool compares now.** The version the lockfile resolved — what CI and
a fresh clone install — against the registry. `pnpm-lock.yaml`,
`package-lock.json` and `yarn.lock` are all read, so this is not pnpm-only. With
no lockfile entry the declared range's floor stands in, and the report says so
rather than passing it off as a resolved version.

**A new finding, reported first.** When `node_modules` disagrees with the
lockfile, the report opens with `NODE_MODULES OUT OF SYNC`, naming both versions
per package. It is deliberately not the same condition as "behind": the fix is
an install, not an upgrade. It shows in the default read-only run, and
`--fail-on-out-of-sync` exits 2 on it in CI. That flag is independent of
`--fail-on-outdated` — neither trips the other — and is named apart from
`ds-resync artifacts --fail-on-drift`, which is about the generated snapshot.

**`elirobinson-ds` now warns too.** Discovery still reads `node_modules`; that
design is correct and unchanged. But while an install has drifted, `ds` and
`ds props <Name>` describe an API that is installed here and is not what CI
builds — the exact path by which an agent writes code that passes locally and
fails on merge. It now prints a one-line caution to **stderr** when installed
and locked disagree. stdout is untouched, so anything parsing that output is
unaffected, and the exit code does not change.

**What changes for a consumer parsing `--json`.** The per-package baseline is
now `currentVersion`, with `currentSource` recording whether it came from the
`lockfile`, a declared `range`, or was `unresolved`. `installedVersion` still
exists but now means only what is in `node_modules` — it is no longer the
comparison baseline, and it can be `null`. `lockedVersion` is new, as is a
top-level `drift` array. Anything reading `installedVersion` as "the version
this repo is on" should read `currentVersion` instead.

Also fixes a latent crash: a `workspace:*` dependency resolves to `link:…` in
the lockfile and its range holds no version, which threw `Unparseable version`
and produced no output at all. Those packages are now reported as not compared.
