# @elirobinson/ai-patterns

## 0.7.0

### Minor Changes

- 36097a8: Resolve `@elirobinson/ai-patterns/testing/playwright` from CommonJS, and declare
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

## 0.6.0

### Minor Changes

- 2c3c5e7: One llms corpus generator, owned by `@elirobinson/ai-patterns`.

  The generator that renders `llms.txt` and `llms-full.txt` existed twice, written
  independently and producing the same format: once in `apps/docs` for the live
  `/llms.txt` routes, once in this package for the snapshot that ships in the
  tarball. `INTRO` and the import rules were duplicated character for character;
  the prop tables, component sections, and index were reimplemented. Both files
  opened with a comment asserting the other was its twin, which is not a mechanism
  — they had already drifted.

  There is now one implementation, published as `@elirobinson/ai-patterns/corpus`
  (`llmsIndex`, `llmsFull`, `versionStamp`, `RESYNC_COMMAND`), with a hand-written
  `llms.d.ts` and a drift test against it, matching how `./testing/playwright` is
  published. It is parameterized by the four things that genuinely differ between
  the two callers, each optional and absent by default:
  - `versions` — stamps the output as a snapshot. The docs site passes none.
  - `prose` — the Foundations and Patterns pages, as plain markdown.
  - `componentAppendix` — extra blocks per component section; the docs site
    appends the page prose and a `/r/<slug>.json` link.
  - `alsoAvailable` — the "what else is here" bullets, which are URLs on a website
    and filenames plus a CLI in a tarball.

  The packed snapshot is byte-identical to what it produced before, and so is the
  docs `/llms.txt`. Two docs outputs change, both deliberately:
  - `/llms-full.txt` gains exactly one trailing newline, so neither a file nor a
    `text/plain` body ends mid-line. Nothing else in it moves.
  - `/r/<slug>.json` spreads the manifest record, so its `importPath` key is now
    `importSpecifier` — the same rename described below, surfacing on the one
    machine-readable route that isn't a corpus.

  Two fixes that only became possible once there was one reader:
  - Component order is driven off `manifest.tiers` rather than a hardcoded
    `['atoms', 'molecules', 'organisms']` in each copy. A tier added to
    `@elirobinson/react` used to drop every component in it out of the corpus
    silently; it now appears, and a component the manifest gives no tier is
    emitted after the tiers rather than discarded.
  - `@elirobinson/react`'s manifest drops `importPath`, which was a byte-identical
    alias of `importSpecifier` published only so the docs site and the `ds` CLI
    could each keep their own name for it. `importSpecifier` is the one name.

  Removing a published manifest field is breaking, so `@elirobinson/react` is
  marked `major`. It is already taking a `major` in this batch, and the field
  being removed was introduced in this same unreleased batch, so no released
  reader ever saw it — but the manifest is a published contract and the bump
  should say what happened to it rather than what it cost.

- c6cfaa0: Make `tokens.css` the only place the token set is written down.

  **`@elirobinson/tokens`**
  - `tokens.json` is now generated from `tokens.css` at build time. The
    hand-maintained file had drifted to 95 leaf values against 151 `:root` custom
    properties — `--signal-200/300/400/600/800/900` and
    `--anchor-200/300/400/600/800/900` were missing entirely, with nothing marking
    the file as partial. All 151 are now present. The nested shape and every key
    that existed before are unchanged, so `@elirobinson/tokens/tokens-data` and
    `@elirobinson/tokens/tokens.json` keep working; 62 leaves were added.
    Values are now copied verbatim out of the stylesheet, so a few that the
    hand-written file had padded change spelling without changing meaning
    (`oklch(86.0% …)` → `oklch(86% …)`).
  - New export `@elirobinson/tokens/parse-tokens-css` — the one CSS token parser,
    previously duplicated in three places across the monorepo.
  - The package has tests for the first time, including one that fails if
    `tokens.json` stops covering every `:root` custom property.

  **`@elirobinson/ai-patterns`**
  - The `colors_and_type.css` shipped into `.claude/skills/miltinson-design/` is
    now the tokens package's own `tokens.css` rather than a hand-kept sibling of
    it. The two had diverged: the copy consumers received was missing the `.dark`
    compatibility selector and the dark-mode `--focus-ring` override, so every
    `outline: 2px solid var(--focus-ring)` was black-on-black in dark mode — a
    silent failure of the `focusVisibleRequired` contract.
  - `ds tokens` now reads only `:root` and, when a token is declared twice, prints
    the declaration CSS actually applies. `--status-success` and
    `--status-warning` are re-pointed at brand colors after the base scale
    declares them, so they previously printed the shadowed value.

### Patch Changes

- cc6dd9d: Add a drift test for the published `testing/playwright` type surface.

  `src/testing/playwright.mjs` is plain JavaScript typed by a hand-written
  `playwright.d.ts`, and `./testing/playwright` publishes both as `types` and
  `import`. Nothing checked that the two agreed, so a rename or a new helper could
  leave the declarations describing a module that no longer exists — invisible in
  this repo, and surfacing only when a consumer's test suite compiles against the
  lie.

  `playwright.types.test.mjs` compares the module's real runtime exports against
  the value declarations parsed out of the `.d.ts` in both directions, and names
  the specific export that drifted in the failure message. No new dependencies.

  Also updates the `no-barrel-imports` check text in `contracts.json`, which
  enumerates the legal `@elirobinson/*` subpaths, to say `styles/*.css` rather
  than `styles/*` — `@elirobinson/react` v2 narrows that export, and the shipped
  contract must not advertise a pattern that no longer resolves.

- 98839c4: Internal: `ds-resync` parses both commands' flags through one table-driven parser instead of two hand-rolled else-if chains, so a flag both commands should honour can no longer land on only one. No change to flag names, defaults, or error messages.
- c476af3: Internal: `ds-resync` generates both commands' `Options:` help from the same flag table it parses with, and the argument handling moved out of `cli.mjs` into a sibling `args.mjs`. Adding a flag is now one edit rather than a table entry plus a matching usage block. The rendered help text is byte-identical, pinned by a test.
- b393053: One component manifest, owned by `@elirobinson/react`.

  `./manifest` now carries everything the two extractors used to produce
  separately. Alongside the existing `name` / `tier` / `subpath` /
  `importSpecifier` / `exports` / `types` / `propsType` / `variants`, every
  component record gains `slug`, `description`, `props` (full prop tables with
  types, defaults, required flags, and per-prop JSDoc), `subComponents`, `hooks`,
  `inherits`, `stylesheetPaths`, `constraints`, and `extractionGaps`; hook records
  gain `description`. `manifestVersion` is `2`. `./manifest` also gains a `types`
  condition, so it is a typed import rather than an `any`.

  `minor` rather than `major`: every v1 field keeps its name and its meaning, so a
  v1 reader keeps working. Three things do change, none of them a v1 field:
  - `inherits` now names bases the previous regex-based extractor gave up on
    (`Table`, `VirtualList`, `VirtualTable`, `Accordion` said `null` and now name
    the type they extend).
  - `organisms/table/core`, which exports helpers `Table` and `VirtualTable`
    share rather than a component of its own name, is no longer listed as a
    component. It was never importable as one, and the types it exports
    (`ColumnDef` and friends) are re-exported from `Table`.
  - The docs-side record's `exportedTypes` is not carried over under that name —
    `types`, which the manifest already published, is the same list derived from
    the AST rather than a regex, and a superset of it.

  Descriptions for components whose source carries no JSDoc still come from a
  curated fallback list, which moved with the extractor to
  `packages/react/scripts/component-descriptions.json`. It moved rather than being
  replaced because removing it means writing JSDoc on 44 components in
  `packages/react/src`, which this change deliberately does not touch; its header
  now says out loud that every entry in it is debt.

  `@elirobinson/ai-patterns` is a `patch`: its published output is unchanged, but
  `build-artifacts.mjs` now reads `@elirobinson/react/manifest` instead of a
  generated file inside `apps/docs`, so producing the tarball no longer depends on
  a documentation app.

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
