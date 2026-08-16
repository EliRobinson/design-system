# @elirobinson/ai-patterns

## 0.13.0

### Minor Changes

- 5a36a91: A control no longer gets to dress up as a link. `@elirobinson/eslint-config/css` gains
  `no-underlined-control-label`: a rule that paints a control's own filled surface and also
  declares `text-decoration: underline` is an error, because an underline is the one visual
  signal a hyperlink owns and a reader cannot tell a button wearing it from a link. A
  link-styled button on no fill, and a link that happens to sit on a fill, are both
  deliberate patterns and stay silent.

  The matching `componentConstraints` entry ships in `@elirobinson/ai-patterns`' contracts,
  with its `verifiedBy` naming the lint rule and the two `@elirobinson/react` tests that pin
  the same property inside the system.

  No token values changed, and no component changed: `.ds-button` already dropped the
  underline in every variant. This is the guard that keeps it that way.

### Patch Changes

- 056ba51: Derive the brand skill's file inventory from what the tarball actually contains.

  The consumer copies of `README.md` and `SKILL.md` listed the skill's files from
  `BRAND_INDEX`, a hand-kept array in `src/artifacts/brand.mjs`. It named the four
  `ui_kits/<kit>/` folders and missed `ui_kits/_shared/`, so every consumer
  received `Primitives.jsx` — the file all four kits load over
  `../_shared/Primitives.jsx` — with no document mentioning it, and a kit copied
  out on the strength of the inventory rendered nothing.

  The rows now come from the files the packer stages, at full depth.
  `BRAND_DESCRIPTIONS` holds only the editorial one-liner per row, and the build
  fails on a shipped folder with no row **and** on a row with no files behind it.
  The check it replaces compared first path segments only, which is why `ui_kits`
  being described four times over was enough to hide a fifth folder from it.

## 0.12.2

### Patch Changes

- ef18f53: Drop the stray chat screenshot from the shipped brand manifest. `uploads/pasted-1777227214382-0.png` was pasted working material, not brand material, but the `@elirobinson/ai-patterns/brand-manifest` export (`dist/artifacts/brand-manifest.json`, published in `dist`) carried an entry for it under `category: "scratch"`. That entry is gone; a `.gitkeep` entry (same `category: "scratch"`, `origin: "incidental"`, `ships: false`) takes its place so the directory stays present for the manifest generator without tracking pasted files.

## 0.12.1

### Patch Changes

- 0917a4d: Self-host Geist and JetBrains Mono. `tokens.css` no longer reaches Google Fonts through a render-blocking remote `@import` — it `@import`s a package-local `fonts.css` that declares `@font-face` over woff2 files shipped in the package (both families are SIL OFL 1.1; licenses included). Importing `@elirobinson/tokens/tokens.css` is enough: bundlers inline the import and emit the font assets, a plain `<link>` resolves it relatively, and no request leaves the consumer's origin. Consumers that stripped the remote import and self-hosted via `@fontsource-variable/*` (plus `--ds-font-*-override` pointing at those families) can delete that wiring. The `@elirobinson/ai-patterns` brand skill ships the same faces alongside `colors_and_type.css`, so its `@import './fonts.css'` resolves in a consumer's `.claude/skills/` too.

## 0.12.0

### Minor Changes

- 32f76d2: Add the **UI Copy Is Chrome** rule, and ship a lint rule for the literal half of it.

  Functional copy — errors, empty states, helper and hint text, toasts, labels,
  button text, tooltips, confirmations, validation — is chrome. It states the fact,
  then the consequence, then the action, and stops. The rule names the six ways
  that gets padded into marketing: unverifiable frequency claims ("almost always"),
  blame attribution ("on their side", "check your connection"), filler pacing ("in
  a moment", "hang tight"), unprompted reassurance or apology ("don't worry",
  "we'll sort it out"), escalation paths nobody asked for, and enthusiasm ("Great
  news!", exclamation marks). Reassurance is allowed only where it answers a
  question the reader is actually asking, and only as a fact: "You have not been
  charged." Past two short sentences, functional copy is explaining, reassuring, or
  selling.

  **The rule governs chrome, never a product's editorial voice**, and that
  distinction is repeated everywhere the rule appears rather than stated once.
  Marketing prose, conversational surfaces, and written deliverables are content;
  their voice is a deliberate design decision and this says nothing about them.
  Read as an instruction to write plainly everywhere, the rule does more harm than
  the padding it removes — which is why it is worth writing down instead of leaving
  to taste.

  Where it now lives, so a consumer picks it up by upgrading:
  - **`pnpm ds patterns`** — as principle 6, and as a line in the **Definition of
    Done for UI work**, which is the checklist agents are told to work before
    calling UI done.
  - **`pnpm ds contracts`** — a new `ui-copy` constraint with its own `check` and
    `verifiedBy`.
  - **All four agent templates** written by `ds init --agents` (`AGENTS.md`'s
    managed block, the Claude Code skill, the Cursor rule, the Copilot
    instructions), so the next `init` carries it into every consuming repo.
  - **`pnpm ds prompts audit-page`** — a seventh check, with editorial content
    explicitly out of scope and wording changes moved to report-don't-fix.

  **New ESLint rule: `@elirobinson/no-padded-ui-copy`**, matching those phrases
  literally. Its scope is the content/chrome line encoded in code rather than left
  to a heuristic: it reads copy props (`title`, `description`, `label`,
  `placeholder`, `helperText`, `error`, `tooltip`, `aria-label`, …) and the
  children of chrome components (`Alert`, `Toast`, `Tooltip`, `Callout`, `Banner`,
  `EmptyState`, `FormMessage`, …). It never reads arbitrary JSX text, so a landing
  page's prose is untouched by construction. The cost is that chrome in an
  unrecognised component is missed, which is the right way round — a rule that
  flagged a product's voice would be switched off within a day.

  **It ships as a warning, not an error.** Every repo upgrading into this has copy
  written before the rule existed, and a hard error on upgrade would block them.
  Raise it once that copy is clean:

  ```js
  export default [...designSystem({ copy: { severity: 'error' } })];
  ```

  `components`, `props` and `allow` options extend or exempt; `severity: 'off'`
  switches it off. The two-sentence limit and the content/chrome judgement stay
  review, not lint — a length check would fire on legitimately long confirmations
  and teach people to disable the rule.

  This repo holds itself to it at `error` across `packages/react` and the docs app,
  which report zero findings today.

## 0.11.0

### Minor Changes

- 242fbe0: The llms corpus gains a brand layer: `llmsFull` accepts an optional `brand` input and renders the voice rules from the brand README (extracted loudly — a missing CONTENT FUNDAMENTALS section throws) plus the kit and asset inventory. The packed snapshot carries only `ships: true` artifacts; a corpus that includes repo-only artifacts gets them marked as such. An agent asked to build a Miltinson page previously got prop tables and tokens and no voice guidance at all.
- 242fbe0: Add `@elirobinson/ai-patterns/brand-manifest`: one record per artifact in `design-system-docs/`, with category, origin (generated cards are identified by importing `buildGuidelineCards`, never a hardcoded list), ships/shipReason derived from `BRAND_SOURCES`, per-artifact render facts (dependencies as written, external origins through the stylesheet chain, viewports), and member roles. The in-repo `design-system-docs/README.md` index table is now generated from it between the managed markers — fixing the phantom `templates/` row, the fifth slide template that never existed, and the auth surface the webapp kit does not export, and adding the six top-level entries the hand-kept table omitted.
- 242fbe0: Two additive surfaces for the MCP server: `@elirobinson/ai-patterns` exports `./adherence` (the generated adherence-config builder) and `./brand-readme` (the packed brand README the voice rules are extracted from), and `@elirobinson/eslint-config` exports `mcpStdio(files)` — a flat-config block for packages that serve MCP over stdio, where a single `console.log` corrupts the JSON-RPC channel: `no-console` at error severity, `console.error` only.

## 0.10.0

### Minor Changes

- 43e1b92: Measure `ds-resync` staleness against the lockfile, and report an out-of-sync `node_modules` as its own finding.

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

## 0.9.2

### Patch Changes

- 4da857a: Fix every documented `dlx` invocation of this package's binaries.

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

## 0.9.1

### Patch Changes

- 7cd6a82: Generate the Claude Design project's API contract, foundation cards and skill docs.

  The design project carried hand-maintained restatements of this repo — an oxlint
  config describing the component API, and swatch cards enumerating the token
  scale — and both had drifted. The config described a flat prop surface where
  `@elirobinson/react` is compound (it put `Sheet`'s `side` on `Sheet` rather than
  `SheetContent`, exported a `ToastViewport` that does not exist, and invented
  seven child components), and the ink card rendered 10 of the 13 `--ink-*` steps.

  Three generators now derive those artifacts from sources that cannot drift —
  `@elirobinson/react/manifest` and `tokens.css` — reached through a new
  `build:design-project` script. They are internal to this repo: none is added to
  the package's `exports`, so nothing new is importable by a consumer.

  **What changes for a consumer.** The `miltinson-design` skill written by
  `ds-resync artifacts` has one paragraph in a different place. The sentence
  naming the tokens stylesheet and the readme is now inside the managed block
  rather than below it, because the three surfaces that carry this skill spell
  those files differently and the paragraph has to be generated per surface
  instead of shared verbatim. The wording and the brand rules are unchanged; only
  the block boundary moved. Re-run `ds-resync artifacts` to pick it up — the hash
  check will report `SKILL.md` as changed.

## 0.9.0

### Minor Changes

- b11ae1b: Give the font families a supported override hook, and write down the cascade
  rule that made overriding a token guesswork.

  Adopting the Tailwind bridge in a `next/font` app silently dropped the brand
  typeface: the page rendered in the system font and nothing errored. Two causes,
  both ours.

  **`@elirobinson/tokens`**
  - `--font-sans`, `--font-display` and `--font-mono` now read a
    `--ds-font-*-override` before their own stack:

    ```css
    :root {
      --ds-font-sans-override: var(--font-geist-sans);
      --ds-font-mono-override: var(--font-geist-mono);
    }
    ```

    `next/font` never exposes a family under its real name — it generates one and
    hands it over in a CSS variable — so the literal `'Geist'` matched nothing the
    app had loaded and `body`, every `.t-*` class and the `font-sans` utility fell
    through to `ui-sans-serif`. Purely additive: an unset override resolves to the
    exact stack that shipped before, so nothing changes for existing consumers.
    Scoped to the three families, because a family is the only token whose value
    the framework legitimately owns at runtime.

  - **`tokens.css` is unlayered, by design, and that is now documented.**
    Unlayered declarations beat anything inside a cascade layer whatever the
    order, so an override written inside `@layer base` — the conventional place in
    a Next.js `globals.css`, and where the docs implied it belonged — silently
    loses. Overrides go in a plain `:root` block. The `--ds-font-*-override` hooks
    are exempt: the stylesheet declares them nowhere, so they apply from any
    layer.
  - `parse-tokens-css` resolves a `var()`'s fallback when the property it names is
    undeclared, the way a browser does, and no longer reads a declaration written
    inside a comment as a token. Without the first, every consumer of the parsed
    token set — `tokens.json`, `ds tokens`, the docs foundations pages, the llms
    snapshot — would have started reporting a raw `var()` for the three families.

  **`@elirobinson/ai-patterns`**
  - `patterns.md` gains a third _Integration note_ alongside the `next-themes`
    selector and the Tailwind bridge — the same species of silent failure —
    including the `<html>` vs `<body>` detail: `--font-geist-sans` has to be
    defined at `:root` for the override to resolve.
  - The `adopt-system` prompt and all four agent instruction templates carry the
    cascade rule and the font hook.
  - `ds tokens` keeps agreeing with the shared parser on comments and on values
    Prettier wrapped across lines.

## 0.8.0

### Minor Changes

- 4fb7251: Resolve `@elirobinson/ai-patterns/corpus` from CommonJS, and declare the Node
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
