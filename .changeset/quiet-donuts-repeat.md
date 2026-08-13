---
'@elirobinson/ai-patterns': patch
---

Fix every documented `dlx` invocation of this package's binaries.

This package ships two bins, `ds-resync` and `elirobinson-ds`. `pnpm dlx <pkg> <bin>`
only resolves for a single-bin package — the trailing word is parsed as an argument to
the implied binary, not as a selector — so every documented entry point aborted with
`ERR_PNPM_DLX_MULTIPLE_BINS` before our code was spawned. The working form names the
package explicitly:

```bash
pnpm --package=@elirobinson/ai-patterns dlx ds-resync artifacts --write
```

`RESYNC_COMMAND` held the broken string and is interpolated into the llms corpus and into
the generated `SKILL.md`, so `ds-resync artifacts --write` wrote a command that cannot run
into every consuming repo's `.claude/skills/`, and the design-system-reference corpus told
agents to run it. Re-run `ds-resync artifacts --write` after upgrading to pick up the
corrected text.

**Why this is a patch and not a minor.** `RESYNC_COMMAND`'s value changes and a new `DLX`
constant is exported, which would normally read as a minor. But the old value names a
command that cannot execute: any consumer depending on it was already broken, there is no
working behaviour to preserve, and there is nothing to migrate. The change only removes a
failure.

Also in this release:

- New export `DLX` from `@elirobinson/ai-patterns/corpus` — the invocation prefix, as one
  constant. `RESYNC_COMMAND` derives from it, and the stale-snapshot warning imports it
  rather than hardcoding a copy.
- `src/artifacts/dlx.test.mjs` executes the documented command for both bins in a scratch
  directory and asserts a zero exit — the check that would have caught this, which an
  assertion on the string alone would not — and fails the build if the bare form reappears
  in any tracked file outside the changelogs and the dated plans under `docs/superpowers/`.
  That guard is what protects the Markdown surfaces, which cannot import a constant.
