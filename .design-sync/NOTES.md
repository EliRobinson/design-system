# design-sync notes — Miltinson Design System

Repo-specific gotchas for syncing `@elirobinson/react` to claude.ai/design.
Read this before touching anything; every bullet cost a debugging cycle.

Project: `Miltinson Design System (Code)` — `d6aec269-c6ad-4fad-8af5-454ca40080f4`
(The pre-existing `Miltinson Design System` project is the hand-authored brand
kit from `design-system-docs/` — a DIFFERENT project. Never sync into it.)

## Setup facts

- Shape: **storybook**. Config dir `apps/storybook/.storybook`; storybook
  devDeps live at the **repo root** (`apps/storybook` has no `package.json`),
  so build the reference from the repo root:
  `npx storybook build -c apps/storybook/.storybook -o "$(git rev-parse --show-toplevel)/.design-sync/sb-reference"`
- `--node-modules` is the **repo root** `node_modules` (pnpm symlinks the
  workspace packages into it; `packages/react/node_modules` is sparse).

## [GENERAL] The package has no barrel — the converter needs two entries

The package deliberately ships no `index.ts` and no `"."` export
(`.cursor/rules/no-barrel-files.mdc`), but the converter needs ONE entry to
bundle and ONE `.d.ts` to read the component roster from.
`.design-sync/gen-entry.mjs` generates both; `cfg.buildCmd` re-runs it after
every `pnpm build` (which `rm -rf`s dist).

- `packages/react/dist/_ds-entry.mjs` — the JS entry (`cfg.entry`).
- `packages/react/index.d.ts` — the types entry.

Both are gitignored, and `index.d.ts` is excluded from the published tarball by
`files: ["dist","src"]` (verified with `npm pack --dry-run`). It is types-only,
so the no-barrel rule's rationale — a runtime barrel forcing consumer bundlers
to load every module — does not apply. **Do not "fix" this by adding a `types`
or `"."` field to `packages/react/package.json`**; that would change the
published package.

Why the entry must live inside `packages/react/` and not `.design-sync/`: the
converter walks UP from `--entry` to the nearest **named** `package.json` to
pick `PKG_DIR`. From `.design-sync/` that walk lands on the monorepo root, and
the build then reads the repo's `types/` dir instead of `packages/react/dist`
— it discovers **0 components** and still exits 0. Silent failure; watch for
`exported PascalCase symbols: 0` in the build log.

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

- **The two generated entries are the fragile part.** `pnpm build` does
  `rm -rf dist`, so `packages/react/dist/_ds-entry.mjs` disappears with it —
  always run the full `cfg.buildCmd`, never a bare `pnpm build`. If a component
  is ADDED or RENAMED and `gen-entry.mjs` isn't re-run, it is silently missing
  from both the bundle and the roster while the build still exits 0. The tell
  is the `components: N` line in the build log — compare it against
  `ls apps/storybook/src/stories/*.stories.tsx | wc -l`.
- **`packages/react/index.d.ts` is untracked and unpublished by design.** If
  someone "tidies" it away or adds a `types`/`"."` field to the package to
  "fix" it, component discovery silently drops to 0. See the no-barrel section
  above before changing anything there.
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
