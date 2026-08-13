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

## Packed artifacts

This package has a real build step — `scripts/build-artifacts.mjs`, wired to both `build`
and `prepack`, so a tarball cannot be produced without it. It stages `dist/artifacts/`:

| Staged at                         | Made from                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `skills/miltinson-design/`        | A subset of `design-system-docs/`                                                     |
| `skills/design-system-reference/` | `@elirobinson/react/manifest`, `packages/tokens/src/tokens.css`, `src/contracts.json` |
| `skills/ds-resync/SKILL.md`       | `src/resync/SKILL.md`                                                                 |
| `artifacts.json`                  | The version stamp and a sha256 per staged file                                        |

`ds-resync artifacts` copies `skills/**` into a consuming repo's `.claude/skills/`. The
tree in `dist` is laid out exactly as it lands there, so the writer copies a directory and
holds no opinion about its contents — adding or removing a skill is a change to
`build-artifacts.mjs` alone.

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
  `ds-resync artifacts` compares that stamp to the consuming repo's install and prints a
  loud STALE SNAPSHOT warning on a mismatch. A snapshot that silently describes a different
  release is exactly how an agent produces confidently wrong prop tables.
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
- The rest say "not automated — review", which is the honest answer.

Adding a constraint means either shipping its check or saying plainly that there isn't one.

## Agent templates

`src/agents/` holds the generic instruction surfaces — Claude Code skill, Cursor rule,
Copilot instructions, and an `AGENTS.md` block — installed by `ds init --agents`. They
cover different tools on purpose: an agent only follows what it actually loads. The
`AGENTS.md` fragment is merged between `<!-- design-system:begin -->` markers so a
consumer's own content survives a re-run.
