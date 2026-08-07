# Run notes — docs site build (2026-08-07)

Scratch log: one entry per decision/correction a future session would otherwise
rediscover. Not a deliverable.

- **Worktree already contained the spec + prompt** (`docs/superpowers/specs/2026-08-07-docs-site-design.md`,
  `docs/prompts/fable-docs-site.md`), untracked. They match the run brief; treated the
  spec's decision table as settled.
- **Workspace linking confirmed**: `packages/react` → `@elirobinson/tokens` resolves as
  `link:../tokens` in pnpm-lock despite a plain `0.2.0` specifier, so `workspace:*` deps
  from apps/docs will link fine and no GH Packages auth is needed for install.
- **Root `.npmrc` warning is benign**: `${NODE_AUTH_TOKEN}` unexpanded → pnpm warns; only
  affects publishing to GH Packages, not local install.
- **Docs consume dist, not source** (unlike Storybook): workspace dep + Nx
  `dependsOn ^build` means the site exercises the real `exports` map — the same
  resolution a consumer gets. Chosen deliberately over source aliasing.
- **Committed generated manifest** (`apps/docs/src/generated/component-manifest.json`):
  regenerated before every build/dev, committed so lint/typecheck/format work without a
  build step. Drift window is zero in artifacts; repo copy refreshed by build.
- **Turbopack MDX constraint**: Next 16 builds with Turbopack; MDX plugin options must be
  serializable, so no function-valued rehype/remark plugins. Syntax highlighting is done
  in the `pre` MDX component mapping (shiki, server-side) instead of a rehype plugin.
- **react-docgen-typescript 2.4.0 works with TypeScript 6.0.3** — the main extraction
  risk didn't materialize. Literal-union props come back as name "enum" with members in
  `type.value`; destructured defaults are extracted.
- **`ds-radio-group` styles live in `molecules/RuleLink.css`**, not a RadioGroup sheet —
  repo wrinkle, recorded as an extraction gap in the manifest rather than fixed (component
  CSS is out of scope). Input/Textarea/Select/Label share `atoms/field.css`; mapped via a
  small config block in the extractor.
- **Descriptions are curated, not extracted**: component source has no JSDoc descriptions,
  so `scripts/component-descriptions.json` feeds one-liners into the manifest (source
  JSDoc wins when present — three hooks have real JSDoc, two plus a curated fallback).
- **Committed the "no purple" rule for code**: shiki's stock themes use purple, so
  `src/lib/shiki-theme.ts` defines a brand theme from computed ink/amber/forest hexes.
  The oklch→sRGB math in `src/lib/color.ts` is verified against the brand README's
  8.7:1 amber-on-ink checksum in tests.
- **tokens.css dark-mode comment is stale #2**: the block says "opt-in via
  [data-theme='dark'] OR prefers-color-scheme" but only the data-attribute selector
  exists — no media query. Docs site ships light-only; didn't add a toggle.
- **Turbopack chokes on `require.resolve` of package CSS/MD assets** ("non-ecmascript
  placeable asset") — `tokens-css.ts` and `PromptTemplate.tsx` read workspace files via
  `process.cwd()/node_modules/...` symlink paths instead.
- **`Toaster` cannot SSR** (portals to `document.body` during render) — the toast page
  wraps its demos in a `ClientOnly` boundary and documents the constraint honestly.
- **Component-source bugs found by subagents while documenting** (documented honestly on
  the pages, source untouched per the brief): `Sheet`'s `defaultOpen` is typed but never
  used; `Tooltip`'s `delayDuration` is a no-op; `VirtualList`'s JSDoc claims a
  `Table virtualize` prop that doesn't exist; `DatePicker` renders grid roles but has no
  arrow-key navigation and no Escape handling; `Avatar`'s fallback-only mode has no
  accessible name (initials span is aria-hidden); `Checkbox` reserves 44px min-height in
  CSS but only the 18px input + label text are actually clickable; `Input`/`Textarea`
  leave a dangling hint id in `aria-describedby` when `error` replaces `hint`;
  `Pagination` has no arrow-key navigation (plain button row).
- **Rebase onto origin/main (pre-PR) invalidated two of those findings** — main had
  meanwhile landed `fix(react): make portal components server-renderable` (Toaster now
  gates its portal on a new `useHasMounted` hook — 6th exported hook) and
  `fix(react): honour defaultOpen on overlay components`. Updated accordingly: toast page
  lost its ClientOnly wrapper (component deleted), sheet page's defaultOpen "don't"
  rewritten, hook counts bumped to 6 (manifest test, hooks page, installation page).
  The manifest picked up `useHasMounted` automatically — the pipeline working as
  designed.
- **Sub-agent fan-out worked with one template violation**: 4 agents (sonnet), 43 pages;
  toast and virtual-table pages omitted `<ComponentHeader />` (caught by a grep audit);
  one cross-agent typecheck error (tabs demo) was fixed by its owner before finishing.
- **Sidebar/nav scope choice**: under 960px the sidebar and header nav are hidden —
  search (⌘K CommandPalette) is the small-screen navigation. Recorded as a deliberate
  scope cut, not an oversight.
- **Patterns pages are code recipes without live stages** — full-width marketing
  compositions don't fit the prose column; Storybook Patterns/Marketing stays the live
  reference, pages state that explicitly.
- **llms-full.txt reuses page prose via `stripMdx`** (imports/JSX dropped, DoDont blocks
  converted to lists) so the AI corpus and human pages can't diverge; structured parts
  (tokens, prop tables, constraints) come from the manifest/contracts directly.
