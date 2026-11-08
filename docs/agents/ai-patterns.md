# AI patterns

`@elirobinson/ai-patterns` is the package consumers install to find out what the design
system offers and what rules their UI has to satisfy. It ships no runtime code — a CLI,
some Markdown, a JSON contract file, and test helpers.

## Working principles

- Keep patterns in `@elirobinson/ai-patterns/patterns` and UX contracts in `@elirobinson/ai-patterns/contracts` — no package root barrel.
- Enforce practical tone and avoid hype language in generated copy.
- Follow `packages/ai-patterns/src/contracts.json` for touch targets, focus-visible, and WCAG AA contrast.
- `ds-resync` (`packages/ai-patterns/src/resync/`) brings a consuming repo's `@elirobinson/*`
  deps up to date: `pnpm --package=@elirobinson/ai-patterns dlx ds-resync` reports, `--write` applies.
  `--only` and `--target` narrow which packages move and how far; `-i` picks interactively.
  The agent-facing instructions ship at `@elirobinson/ai-patterns/resync/skill`.
- `ds-resync artifacts` syncs the agent _skills_ rather than the versions. See
  "Packed artifacts" below.

## Two bins, two questions

The package ships both, and they are easy to confuse:

| Bin                           | Answers                                           |
| ----------------------------- | ------------------------------------------------- |
| `elirobinson-ds` (`src/cli/`) | "What does the version I have installed offer?"   |
| `ds-resync` (`src/resync/`)   | "Am I behind, and what changed while I was away?" |

`ds-resync` reads the registry and rewrites dependency ranges. `elirobinson-ds` never
touches the network — it only describes what is already in `node_modules`. A consumer runs
`ds-resync` occasionally and `ds` constantly.

Both work whether or not the package is installed in the project they are pointed at, so
either can be run through `dlx`. Name the package explicitly when you do:

```bash
pnpm --package=@elirobinson/ai-patterns dlx <bin>
```

The bare `pnpm dlx <pkg> <bin>` form **does not work here** and never did. It only resolves
for a single-bin package: the trailing word is parsed as an argument to the implied binary,
not as a selector for which binary to run.
With two bins pnpm has nothing to imply, so it aborts with `ERR_PNPM_DLX_MULTIPLE_BINS`
before our code is ever spawned — which is also why `ds-resync` cannot report this failure
the way `registry.mjs:describeNpmFailure` reports a 401. There is no process to report from.
Because two bins are the whole point of this package, that form cannot be made to work;
it can only be avoided.

`DLX` in `src/artifacts/llms.mjs` is the one place the prefix is written down, and every
`.mjs` caller imports it. Markdown can't import a constant, so `src/artifacts/dlx.test.mjs`
covers it from the other side: it executes the documented command and asserts a zero exit,
and it fails the build if the bare form reappears in any tracked file outside the
changelogs and the dated plans under `docs/superpowers/`.

Running through `dlx` is also why `loadEnvironment` takes a `selfDir`: when the binary runs
from a dlx store it is absent from the project's `node_modules`, and without the fallback
every command backed by this package's own data would report itself as not installed.
`src/cli/cli.test.mjs` pins it.

## Discover, don't document

The **`elirobinson-ds`** bin (`src/cli/`) reads the _installed_ packages at run time, so
nothing it prints can go stale. Consumers alias it as `"ds": "elirobinson-ds"`.

Two properties are load-bearing and must survive any change here:

- **Layout-agnostic.** Components are discovered by walking the package tree, never by
  assuming a structure. The same code describes 0.x's 24 flat components and 1.x's 45
  across `atoms`/`molecules`/`organisms`; `src/cli/cli.test.mjs` builds both layouts and
  asserts it.
- **Degrades gracefully.** A missing package produces an instruction naming what to
  install, not a stack trace.

It prefers `@elirobinson/react`'s `dist/manifest.json` and falls back to parsing emitted
`.d.ts` only when an older install has no manifest. Prefer teaching the manifest generator
(`packages/react/scripts/manifest.mjs`) something new over teaching the fallback.

**Never add an inventory to prose** — not to this file, not to the agent templates, not to
a README. Anything listing components, tokens, or props is wrong as of the next release.
Point at `ds`.

## `ds check`: the traps that fail silently

`ds check` (`src/cli/check/`) reads a consumer repo and its installed packages, and reports
each known trap that makes an app look wrong with no error: the issue number it came from,
where it is, and the exact fix. Every check is one entry in `TRAPS` in `traps.mjs`.

- **Warn first (#328).** It exits 0 with warnings. `--strict` exits 1 on any warning, so an
  app can gate CI on it. Failing by default would break builds that pass today, so it
  needs a major version.
- **One fixture per trap.** `src/cli/check/__fixtures__/<trap id>/` is a tiny consumer that
  trips that trap and nothing else, and `clean/` trips nothing. `check.test.mjs` fails when
  a trap has no fixture or a fixture has no trap. `installed.json` names the versions the
  test installs; `{{react}}` and `{{tokens}}` mean the workspace versions.
- **Quiet when unsure.** A check that cannot tell returns nothing. A warning consumers learn
  to ignore is worse than none.
- **A fixed trap leaves two things.** The check that finds it in an app, and a `FIXED_IN`
  row so an older install still gets told. `container-widths` reads the installed
  `tokens.css`, so it goes quiet by itself when #250 lands.

The agent templates, `ds init --agents` and the `ds-migrate` patterns all tell an agent to
run it after setup and after every upgrade, so a consumer learns about a new check by
upgrading.

## Packed artifacts

This package has a real build step — `scripts/build-artifacts.mjs`, wired to both `build`
and `prepack`, so a tarball cannot be produced without it. It stages `dist/artifacts/`:

| Staged at                         | Made from                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `skills/miltinson-design/`        | A subset of `design-system-docs/`                                                     |
| `skills/design-system-reference/` | `@elirobinson/react/manifest`, `packages/tokens/src/tokens.css`, `src/contracts.json` |
| `skills/ds-resync/SKILL.md`       | `src/resync/SKILL.md`                                                                 |
| `skills/ds-migrate/`              | `src/migrate/**/*.md`, plus `src/prompts/adopt-system.md`                             |
| `reference-inputs.json`           | Voice pack id, note and brand artifact list (the voice itself is read from README.md) |
| `artifacts.json`                  | The version stamp and a sha256 per staged file                                        |

`ds-resync artifacts` writes `skills/**` into a consuming repo's `.claude/skills/`. The
tree in `dist` is laid out exactly as it lands there. Adding or removing a skill is a change
to `build-artifacts.mjs` alone.

**What a consumer gets is generated from what it has installed (#257).** A react or tokens
release does not release ai-patterns, so a packed snapshot is one release behind the moment
a consumer upgrades. So `ds-resync artifacts` does not copy every staged file. It finds
`@elirobinson/react` and `@elirobinson/tokens` in the `node_modules` folders at and above
the consumer's cwd, where the consumer's own imports look (`src/resync/installed.mjs`). Each
staged file's `source` in `artifacts.json` says what happens next:

- `{ "kind": "reference" }`: the three `design-system-reference/` files are rebuilt by
  `src/artifacts/reference.mjs`, the same builder the pack step runs, from the installed
  manifest and the installed tokens. The tokens are parsed by the installed package's own
  `./parse-tokens-css`, imported from it: the consumer's installed code, the same trust as
  their own build.
- `{ "kind": "package", "package", "path", "specifier"? }`: the token stylesheets and fonts
  in `miltinson-design/` (symlinks into `packages/tokens` here) are copied out of the
  installed package, through its exports map when `specifier` is set. Each copied
  stylesheet's relative `url()` and `@import` targets are followed, so a font a newer tokens
  release added is written too. A target the package does not have is reported.
- No `source`: ai-patterns' own file, written as staged.

The record and the report then carry the installed versions, so "Already current" means
"matches what is installed". `--fail-on-drift` exits 2 on a dry run when the record names
other versions than the installed ones: a react or tokens bump nobody re-ran `--write` for.
If either package is missing, unreadable, or too old to export `./manifest`,
`./parse-tokens-css` and `./token-stylesheets`, the staged snapshot is written instead and
the report says why.

Five things are load-bearing:

- **There is one llms corpus generator**, `src/artifacts/llms.mjs`, published as
  `@elirobinson/ai-patterns/corpus`. `scripts/build-artifacts.mjs` renders the packed
  snapshot with it and `apps/docs` serves `/llms.txt` and `/llms-full.txt` from it. The two
  differ in exactly four optional arguments — a `versions` stamp, `prose`, a
  `componentAppendix`, and the `alsoAvailable` bullets — and in nothing else. Do not add a
  second renderer, however well commented: the two used to be twin files whose headers said
  so, and they drifted anyway. `llms.d.ts` is hand-written because this package ships `src`
  uncompiled; `llms.types.test.mjs` is what stops it lying.
- **The llms snapshot never builds `apps/docs`.** It reads `@elirobinson/react/manifest`,
  the same published artifact a consumer reads, resolved through the exports map. There is
  exactly one component manifest and `packages/react` owns it; `apps/docs` is another
  reader, not a producer. Do not reintroduce an extractor outside that package, and do not
  make packing depend on an app.
- **`design-system-docs/preview/` and `uploads/` never ship** — working material. Neither do
  `slides/` or `templates/`, which produce Miltinson marketing collateral a consuming
  product repo has no use for. `BRAND_SOURCES` in the build script is the list.
- **Every artifact carries the `@elirobinson/react` version it was generated against.**
  Normally that is the installed one. When `ds-resync artifacts` has to fall back to the
  staged snapshot, it compares the snapshot's stamp to the consuming repo's install and
  prints a loud STALE SNAPSHOT warning on a mismatch. A snapshot that silently describes a
  different release is exactly how an agent produces confidently wrong prop tables.
- **Two passages in the brand docs are generated, not copied.** The README's INDEX table and
  the SKILL.md pointer at the component reference differ between this repo and a consumer,
  so they live between `<!-- ds-artifacts:managed:begin -->` markers and are rewritten at
  pack time from what actually shipped. A missing marker fails the build rather than
  shipping repo-relative prose.

## Contracts and what verifies them

Every entry in `contracts.json` carries a `verifiedBy` naming the rule or helper that
enforces it, so a reader can tell which constraints are automated:

- Statically checkable ones → `@elirobinson/eslint-config`.
- Ones only a browser can settle → `src/testing/playwright.mjs`.
- Ones only a pixel comparison can settle → `src/testing/visual-config.mjs` and
  `src/testing/visual-sweep.mjs`.
- The rest say "not automated — review", which is the honest answer.

Adding a constraint means either shipping its check or saying plainly that there isn't one.

The visual modules follow the same rule the rest of this package does: nothing they ship
contains a list of what to cover. `sweepStorybook` and `sweepPages` register their tests
from a build's own `index.json` and prerender manifest, so this repo's suite and a
consumer's are the same code pointed at different builds. Repo-specific values — ports,
build directories, which routes this docs site cannot hold still — stay in
`tests/visual/`, and they are the only thing that differs.

## SDK core: the `./server` entry

`@elirobinson/ai-patterns/server` wraps AI SDK Core so a consumer's route handler emits a
stream our components can render without a mapping layer. It is the non-visual half of the
AI tier: client UI renders whatever the stream contains and has nothing to say about what
the model was told, and that half is ours.

Four things live there, and one rule holds all of them together.

| Subpath                    | What it is                                                                     |
| -------------------------- | ------------------------------------------------------------------------------ |
| `./server`                 | `streamText` / `generateObject` / `streamObject` with the house prompt applied |
| `./server/prompt`          | The prompt itself, rendered from `contracts.json`                              |
| `./server/tools`           | Display metadata for tools — the layer `tool()` has no room for                |
| `./server/surfaces/<name>` | One structured surface: its Zod schema and its renderer, together              |

**The prompt is read, never written down.** `houseSystemPrompt()` renders
`contracts.json → systemPromptStyle` at run time, and a consumer's own `system` string is
_appended_ to it rather than replacing it. That is the CLAUDE.md rule applied to prompts:
a route that pasted our voice would be wrong the next time the contract moved, and nothing
would fail. `prompt.test.mjs` holds both ends of the derivation — every contract value
reaches the rendered prompt, and none of them appears as a literal in the module.

Three more constraints, each with a check behind it:

- **`ai` and `zod` are optional peers.** The consumer owns the version and there is never a
  second copy in the process. `dependency-boundary.test.mjs` covers this across the repo;
  `server/exports.test.mjs` names the file when it is one of these.
- **Nothing server-only leaks into a browser bundle.** The `./server…` subpaths declare
  `types` and `import` and no `require` condition — `ai` is ESM-only, so a CommonJS require
  would resolve and then die inside the SDK. `exports.test.mjs` resolves every subpath in a
  real Node process and reads every module for browser globals and undeclared imports.
- **A model, never a model id.** `LanguageModel` accepts a string, which the SDK routes
  through its own gateway — so a string, or a provider that has not been called yet, is
  rejected with the call that fixes it.

The three structured surfaces (`DecisionCard`, `VerdictBadge`, `StubCard`) are the one
place this package restates another package's prop names. `surfaces.test.mjs` checks every
key against `@elirobinson/react/manifest` and holds an exclusion list to the same standard
the dependency boundary holds its permitted imports: a prop is left out for a stated
reason, and an exclusion naming a prop that no longer exists fails the suite.

Worked routes are in `packages/ai-patterns/docs/examples/`, and the repo's `tsc` compiles
them, so they cannot drift from the export map.

## Migration patterns

`src/migrate/` is the `ds-migrate` skill (#322): how an agent moves an existing site onto
the system. `adopt/<source>.md` has one file per source system (raw Tailwind, shadcn/ui,
MUI, Bootstrap, hand-written CSS), each mapping colour, type, spacing, radius, shadow and
components, with before and after code. `upgrade.md` has one section per breaking change
in any `@elirobinson/*` package. `ds-resync artifacts --write` installs the folder at
`.claude/skills/ds-migrate/`, and `./migrate/*.md` exports the same files.

These files restate names the other packages own, so two suites keep them honest:

- `migrate-files.test.mjs` reads every file the way an agent does. Each fenced block is
  labelled `before` (the source system, never checked) or `after` (ours). An `after`
  block is parsed and every import, component, prop, literal variant, required prop,
  token, Tailwind colour utility and `ds-*` class is checked against
  `@elirobinson/react/manifest`, the token stylesheets and the Tailwind bridge, then
  linted with `@elirobinson/eslint-config`. Table columns headed `Miltinson` or
  `HTML classes` are checked the same way, and a `Source px` column must map to the
  nearest token on that scale. An unlabelled block fails.
- `upgrade-coverage.test.mjs` ties `upgrade.md` to the released changelogs, to the pending
  `.changeset/*.md` files and to `@elirobinson/tokens/migrations`. The rules live in
  `scripts/upgrade-coverage.mjs`:
  - Every `major` changeset, and every 0.x `minor` one whose text starts with
    `**Breaking:**`, needs a section for each package it bumps. The word "breaking"
    anywhere else does not count. A pending 0.x minor that starts like the marker but is
    not it (`Breaking:`, `**BREAKING:**`) fails, so a typo cannot hide a break. If one
    changeset breaks only some of the packages it bumps, split it.
  - Every token migration needs exactly one section, except a silent one
    (`report: "none"`): it renders the same and breaks nothing, so a section is allowed
    but not required.
  - A section naming a change that is not there fails.

So adding a breaking change means adding its section to `upgrade.md` in the same PR. The
change has no version or hash yet, so the section says:

```md
- Package: `@elirobinson/tokens`
- Version: `pending`
- Changeset: `brave-foxes-jump`
```

`brave-foxes-jump` is the changeset file name without `.md`. Pending changesets, and the
version each package will get, come from Changesets' own release plan
(`@changesets/get-release-plan`). A pending section with a `Token migration` line is held
to that version.

The root `changeset:version` script runs `scripts/stamp-upgrade.mjs` right after
`changeset version`. It swaps each pending pair for the released version and the changelog
hash (the first 7 characters of the commit that added the changeset file, as Changesets
writes it). Then it checks coverage and fails the release if anything is off, because the
release runs no tests before it pushes. So the release commit keeps `main` green.
`scripts/upgrade-coverage.release.test.mjs` runs that whole path in a scratch repo with the
real `changeset version`.

`.changeset/` is outside the project graph, so `nx affected` alone would not run this
suite for a PR that only adds a changeset. `Quality` runs it on every PR as its own step.

## Agent templates

`src/agents/` holds the generic instruction surfaces — Claude Code skill, Cursor rule,
Copilot instructions, and an `AGENTS.md` block — installed by `ds init --agents`. They
cover different tools on purpose: an agent only follows what it actually loads. The
`AGENTS.md` fragment is merged between `<!-- design-system:begin -->` markers so a
consumer's own content survives a re-run.
