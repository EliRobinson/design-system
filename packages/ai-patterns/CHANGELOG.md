# @elirobinson/ai-patterns

## 0.5.0

### Minor Changes

- 68d5273: **Fixes `ds-resync` never running when installed.** Since it shipped in 0.4.0, the CLI
  detected whether it was the entry point by checking that `process.argv[1]` ended in
  `cli.mjs`. npm installs a bin as a symlink, so Node reports `.bin/ds-resync` there and the
  check never matched — the command exited 0 having done nothing, on every install. If you
  ran `ds-resync` against 0.4.0 and it appeared to succeed, it did not run; re-run it on this
  version. Entry-point detection now resolves the real path, and a test spawns the CLI
  through a symlink so this cannot regress.

  `ds-resync artifacts` syncs the design system's agent guidance into a consuming repo.
  Three skills land under `.claude/skills/`: the Miltinson brand skill, a version-stamped
  component reference (`llms.txt` / `llms-full.txt` covering every component, prop table,
  token, and machine-checkable constraint), and the `ds-resync` instructions themselves.
  Read-only by default; `--write` applies.

  The package now has a real build/`prepack` step that stages all of it into the tarball,
  so none of this depends on a docs site that is not deployed anywhere. The `/llms-full.txt`
  URLs in `resync/skill`, `prompts/audit-page`, and `prompts/add-component` — which never
  resolved — now point at what actually ships.

  Re-running is safe by construction. Every file written is recorded with its sha256 in
  `.claude/ds-artifacts.json`; a file that still matches is updated, and a file you have
  edited is left exactly as you left it and named in the report. `--force` takes the shipped
  copy instead.

  Each artifact carries the `@elirobinson/react` version it was generated against, and the
  command warns loudly when that is not the version the repo has installed — a snapshot that
  silently describes a different release is how an agent ends up with confidently wrong prop
  tables. `--fail-on-drift` turns that into exit 2 for CI.

## 0.4.0

### Minor Changes

- 8c7d56b: Make the contracts executable and ship the agent-instruction surfaces.
  - New `@elirobinson/ai-patterns/testing/playwright`: `checkTouchTargets`,
    `checkHitAreaOverlap`, `checkFocusVisible`, `checkContrast` and
    `expectDesignSystemContracts` for the `uiContracts` only a browser can settle. Touch
    targets are measured as the _effective_ hit area, so a small glyph expanded with padding
    or a bounded overlay passes. `@playwright/test` and `axe-core` are optional peers.
  - New `@elirobinson/ai-patterns/agents/*`: a Claude Code skill, a Cursor rule, Copilot
    instructions, and an `AGENTS.md` block, installed by `ds init --agents`. None of them
    contains an inventory — they point at `ds`. The `AGENTS.md` fragment merges between
    markers so a consumer's own content survives a re-run.
  - `contracts.json` gains a `verifiedBy` for every entry, naming the lint rule or test
    helper that enforces it — or saying plainly that it is review-only. Two constraints the
    system always implied are now stated: `no-foreign-component-libraries` and
    `no-hardcoded-design-values`. Existing keys keep their existing types;
    `uiContracts.verifiedBy` is a sibling map, so `uiContracts.minimumTouchTarget` is still
    the string `"44x44"`.
  - `patterns.md` gains **Discover, Don't Document** and **Definition of Done for UI work**,
    plus integration notes for the two traps that fail silently: `next-themes` defaulting to
    a `class` strategy the stylesheet never looks at, and Tailwind utilities resolving to
    nothing without the token bridge.
  - The `adopt-system` prompt now starts by wiring up the tooling — CLI, ESLint config,
    Tailwind bridge, agent files, contract tests — before migrating any screen.

- 8c7d56b: Ship the `elirobinson-ds` discovery CLI as a `bin`, so agents and humans ask the installed
  packages what exists instead of trusting a doc.

  Consumers reduce to one package.json line — `"ds": "elirobinson-ds"` — and get `ds`,
  `ds props <Name>`, `ds tokens [filter]`, `ds classes [filter]`, `ds contracts`,
  `ds patterns`, `ds prompts [name]` and `ds init --agents`. Discovery walks the installed
  package tree rather than assuming a directory structure, so the same command describes a
  flat 0.x layout and a tiered 1.x one; it reads `@elirobinson/react`'s new `manifest.json`
  and falls back to parsing emitted declarations on older installs. A missing package
  produces an instruction naming what to install.

  It works from an install (`pnpm ds`, `pnpm exec elirobinson-ds`) or straight from the
  registry (`pnpm dlx @elirobinson/ai-patterns elirobinson-ds`). In the `dlx` case the binary
  is absent from the project's own `node_modules`, so it falls back to its own package root
  for contracts, patterns and prompts rather than reporting itself as not installed.

- a82dcc9: Add `ds-resync`, a command for bringing a consuming repo's `@elirobinson/*` packages up to
  date. A bare run reports current versus latest per package along with the changelog entries
  in between; `--write` rewrites the ranges and installs.

  `@elirobinson/react` and `@elirobinson/tokens` now ship `CHANGELOG.md` in their published
  tarballs, which is what makes the migration notes readable from a consuming repo.

- a6f2796: `ds-resync` can now upgrade a subset of packages, each to a chosen distance. `--only`
  restricts the run to named packages, `--target` picks how far to jump (`latest`, `minor`,
  or `patch`, globally or per package), and `-i` walks the choices interactively.

  This exists for the case that actually blocks an upgrade: a breaking major you are not
  ready for should not cost you the fixes below it. The report names any version held back
  so the deferred migration stays visible.

## 0.3.0

### Minor Changes

- 96092e7: Add prompt templates and extend the machine-checkable contracts.

  Three prompt templates ship under `./prompts/*` (new export): adding a
  component to the system, adopting the system in an existing app, and
  auditing a page for token/accessibility compliance. Each follows the
  existing `patterns.md` house style — intent, constraints, verification
  checklist — and is rendered on the new documentation site's "Build with
  AI" page.

  `contracts.json` gains a `componentConstraints` block so the constraints
  that previously lived only in prose (`docs/agents/components.md`) are
  machine-checkable: the scoped touch-target policy, the `forwardRef`
  requirement, the tier boundary rule, and the no-barrel-imports import
  convention. All existing keys (`systemPromptStyle`, `uiContracts`) are
  unchanged.

## 0.2.0

### Minor Changes

- 52b1b6d: Remove root barrel exports. Import token data from `@elirobinson/tokens/tokens-data` and AI patterns from `@elirobinson/ai-patterns/patterns` or `./contracts`.

## 0.1.1

### Patch Changes

- 60e0c53: Publish design system packages to the GitHub Packages npm registry.
