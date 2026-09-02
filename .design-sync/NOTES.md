# design-sync notes — Miltinson Design System

Repo-specific gotchas for syncing `@elirobinson/react` to claude.ai/design.
Read this before touching anything; every bullet cost a debugging cycle.

Project: `Miltinson Design System (Code)` — `d6aec269-c6ad-4fad-8af5-454ca40080f4`
(The pre-existing `Miltinson Design System` project is the hand-authored brand
kit from `design-system-docs/` — a DIFFERENT project. Never sync into it.)

> **2026-09-02: the pinned project no longer exists.** `get_project` on
> `d6aec269-…` returns HTTP 404, and `list_projects` shows only the brand-kit
> project. The pin is deliberately left in `config.json` so the next run 404s
> loudly and lands here, rather than silently creating a duplicate. Running
> this pipeline again means a **first-time import** into a new project: 50
> components, 99 stories, every one re-graded from scratch, because the deleted
> project took `_ds_sync.json` — the only carry-forward anchor — with it.
>
> The brand-kit project is still current: it is fed by
> `pnpm -F @elirobinson/ai-patterns build:design-project`, a separate,
> narrower pipeline that writes 66 files and deletes nothing. See the header
> comment in `packages/ai-patterns/scripts/build-design-project.mjs` for why
> that one, not this one, owns that project. Do not "consolidate" them by
> pointing `.design-sync` at the brand kit: its delete pass covers
> `components/`, `guidelines/`, `tokens/`, `_preview/`, `_vendor/` and `fonts/`,
> which is where that project's hand-authored guideline and token cards live.

## Setup facts

- Shape: **storybook**. Config dir `apps/storybook/.storybook`; storybook
  devDeps live at the **repo root** (`apps/storybook` has no `package.json`),
  so build the reference from the repo root:
  `npx storybook build -c apps/storybook/.storybook -o "$(git rev-parse --show-toplevel)/.design-sync/sb-reference"`
- `--node-modules` is the **repo root** `node_modules` (pnpm symlinks the
  workspace packages into it; `packages/react/node_modules` is sparse).

## How to run a sync

```bash
node .design-sync/sync.mjs                      # full run
node .design-sync/sync.mjs --remote .design-sync/.cache/remote-sync.json
node .design-sync/sync.mjs --skip-build         # iterate without rebuilding dist
```

It runs `cfg.buildCmd` (which `resync.mjs` does not), checks the generated
types entry is current, warns if the reference storybook is older than the DS
source, runs the driver, and then asserts the built roster matches Storybook.
Any extra flags are passed through to `resync.mjs`.

**`cfg.buildCmd` is scoped to `pnpm -F "@elirobinson/react..." build`, not
`pnpm build`.** The converter only needs `packages/react/dist` and
`packages/tokens/dist`; `pnpm build` is `nx run-many -t build` across all six
projects, so it also builds the Next.js docs site and a full
`apps/storybook/storybook-static/` — minutes of work the sync throws away, plus
the Vite `[PLUGIN_TIMINGS]` and >500 kB chunk warnings that come with it. The
trailing `...` is required: it pulls in the workspace deps (tokens). Scoped, the
build is ~4s and touches 2 of 6 projects. Note this is unrelated to
`.design-sync/sb-reference/`, which is built separately and IS needed.

**The roster assertion is the important part.** `built === storybook titles −
cfg.titleMap nulls`. It is the only check that catches an empty or short
roster: the converter's own gates do not — see below.

## [GENERAL] The package has no barrel — the converter needs two entries

The package deliberately ships no `index.ts` and no `"."` export
(`.cursor/rules/no-barrel-files.mdc`), but the converter needs ONE entry to
bundle and ONE `.d.ts` to read the component roster from.
`.design-sync/gen-entry.mjs` generates both; `cfg.buildCmd` re-runs it.

| File                           | Committed?      | Why                                       |
| ------------------------------ | --------------- | ----------------------------------------- |
| `packages/react/_ds-entry.mjs` | no (gitignored) | value entry; missing = **loud** failure   |
| `packages/react/index.d.ts`    | **yes**         | types entry; missing = **silent** failure |

**Both live in the package ROOT, not in `dist/`.** `files: ["dist","src"]`
excludes the root, so neither ships in the tarball (verified with
`npm pack --dry-run`: 332 files = 208 dist + 123 src + package.json). An
earlier revision wrote the value entry into `dist/` and it **did** ship — a
barrel inside the published package. Never move them back into `dist/`.

Consumers can't reach either one: `exports` has no `"."`, and the repo uses
`moduleResolution: "Bundler"`, so a root import doesn't resolve even in-repo.
The no-barrel rule targets a RUNTIME barrel inflating consumer bundles; a
`.d.ts` is erased at build time. **Do not "fix" this by adding a `types` or
`"."` field to `packages/react/package.json`** — pnpm substitutes
`publishConfig` fields at publish time, so that would change the real package.

### Why index.d.ts is committed

Because its absence is **silent and catastrophic**. Verified by experiment:
with it missing, the converter reports `exported PascalCase symbols: 0`, emits
a zero-component bundle, and **both `package-build.mjs` and
`package-validate.mjs` exit 0** — validate even prints `✓ bundle is complete`
and `tokens-only DS`. A re-sync would publish an empty design system over a
good one with every gate green. It lives in the package root so it survives
`pnpm build` (which only `rm -rf`s `dist/`), and committing it removes the last
realistic trigger: missing on a fresh clone.

The residual risk is drift (a component added without regenerating). Guard:

```bash
node .design-sync/gen-entry.mjs --check   # exits 1 if index.d.ts is stale
```

Its diff is meaningful review signal — it changes only when a component enters
or leaves the public surface. Same rationale as a committed API-surface report.

**Run `node .design-sync/sync.mjs`, not `resync.mjs` directly.** The driver
goes straight to `package-build.mjs` and never runs `cfg.buildCmd`, so on its
own it converts a stale `dist/` with stale entries. `sync.mjs` runs the inputs
first and guards the output (see "How to run a sync" below).

Why the entries must live inside `packages/react/` at all: the converter walks
UP from `--entry` to the nearest **named** `package.json` to pick `PKG_DIR`.
From `.design-sync/` that walk lands on the monorepo root, and the build then
reads the repo's `types/` dir instead of `packages/react/dist` — 0 components,
exit 0. Watch for `exported PascalCase symbols: 0` in the build log.

## [GENERAL] Config paths are resolved relative to PKG_DIR

`cfg.tsconfig` / `cfg.cssEntry` etc. resolve against `packages/react`, not the
repo root — hence `"tsconfig": "../../tsconfig.base.json"`. A wrong path is a
one-line `! <field>: … not found — skipped` in the build log, not an error.
`tsconfig.base.json` supplies the `@design-system/*` path aliases every story
imports through.

## [GENERAL] Do NOT set cfg.cssEntry

`packages/react/src/styles.css` is an **`@import` manifest**, not compiled CSS:
it `@import`s `@elirobinson/tokens/tokens.css` (bare package specifier) plus
~40 relative `./components/**/*.css` paths. Pointing `cssEntry` at it copies
those dangling imports verbatim into `_ds_bundle.css` (2 KB) and **every design
renders unstyled** — while the build still exits 0.

With `cssEntry` unset, `[CSS_FROM_STORYBOOK]` scrapes the **compiled** 34 KB
stylesheet out of `.design-sync/sb-reference`. That is the correct source here.
Don't hardcode a path to it — the filename carries a content hash that changes
on every storybook build.

- `cfg.tokensGlob: "src/*.css"` is required: the tokens package keeps its CSS
  at `src/tokens.css`, and the default probe only looks in
  `dist/css`, `css`, `dist`, `.`.

## Fonts are remote by design

`tokens.css` `@import`s Geist + JetBrains Mono from Google Fonts. This is how
the package really ships, so previews and the storybook reference load the
same remote CSS and grading is apples-to-apples. **Verify egress before
grading** (`curl -sS -o /dev/null -w '%{http_code}' 'https://fonts.googleapis.com/css2?family=Geist:wght@400&display=swap'`)
— if the shell is network-sandboxed both panels fall back to the same system
font and grades pass falsely. `[FONT_REMOTE]` in validate is expected, not
`[FONT_MISSING]`.

## Excluded / overridden

- `titleMap: {"Marketing": null}` — `Patterns/Marketing`
  (`MarketingPattern.stories.tsx`) is a composition demo with `render:`
  functions and **no backing package export**; it documents that Header/Footer/
  Hero/Sidebar/TopBar are app-level compositions, not primitives. Excluded from
  the component roster; the guidance belongs in `conventions.md` instead.
- `overrides.CommandPalette: {cardMode: "single", primaryStory: "Default"}` —
  validate flagged `[GRID_OVERFLOW] … (fixed/portal)`; the palette positions
  itself outside its grid cell.
- `docs: 0/44 matched` is expected — the repo has no per-component docs.
  `apps/docs/**/page.mdx` are pattern/guide pages, not component docs;
  `.prompt.md` files are generated from `.d.ts` + stories.

## Re-sync risks

What can silently go stale or was only partially verified. Check these first.

- **Component drift in the generated entries.** If a component is ADDED or
  RENAMED without re-running `gen-entry.mjs`, it is missing from the bundle and
  the roster while the build still exits 0. `sync.mjs` now catches this (roster
  assertion); it only bites if someone runs `resync.mjs` directly.
- **Don't let anyone "tidy away" `packages/react/index.d.ts`,** move either
  entry into `dist/`, or add a `types`/`"."` field to the package. See the
  no-barrel section above — each of those either silently zeroes the roster or
  ships a barrel in the tarball.
- **CSS depends on the storybook reference.** `_ds_bundle.css` is scraped from
  `.design-sync/sb-reference` (`[CSS_FROM_STORYBOOK]`), so the reference MUST be
  rebuilt whenever component CSS changes — a stale reference ships stale styles
  with no warning beyond `[REFERENCE_STALE?]`. Never set `cfg.cssEntry` to
  "fix" this.
- **Fonts are fetched from Google Fonts at capture time.** Grades are only
  trustworthy from a shell with egress; a sandboxed re-sync makes both panels
  fall back identically and pass falsely. Re-verify egress before grading.
- **Interaction-driven states were never visually verified.** Dialog, Sheet,
  Popover, Tooltip, DropdownMenu, Combobox, Accordion, and Toast stories all
  render only their closed/trigger state in both panels — the open overlay,
  menu, and toast bodies are unverified by construction. Only CommandPalette
  renders its open state (and only on the preview side).
- **CommandPalette's grade is asymmetric.** Storybook crops its capture to the
  trigger strip, so the reference side shows no palette at all; the grade rests
  on judging the preview render on its own. Don't "fix" the preview to match
  the truncated reference.
- **Button is capped.** All runs use `--max-stories 8` (default is 6, and
  Button has 7). Keep the flag or Button's `Large` story stops being captured.
- **Toolchain at time of sync:** node v26.5.0 (repo pins `>=24`), pnpm 10.11.1,
  storybook 10.3.5, React 19.2.5, `@elirobinson/react@1.1.0`.
- `[FONT_REMOTE]` is the only expected validate warning. Anything else is new.
