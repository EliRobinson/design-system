# Run notes — docs site build (2026-08-07)

Scratch log: one entry per decision/correction a future session would otherwise
rediscover. Not a deliverable.

- **Hydration bug found post-PR**: every MDX page's intro used
  `<p className="lead">\n  text...\n</p>`. Remark treats a JSX tag's own-line
  content as block markdown, wraps it in a `<p>` mdast node, and nests that
  inside the literal `<p>` — `<p><p>...</p></p>` in the DOM, which React
  flags as invalid HTML and a hydration mismatch. Fixed across all 20 MDX
  pages by dropping the wrapper and letting the paragraph stand as plain
  markdown (the first paragraph after the page's `h1`), with the `.lead`
  visual style moved onto a `.prose > h1 + p` CSS selector. `ComponentHeader.tsx`
  and the two `.tsx` index pages keep `<p className="lead">` as real JSX
  (not MDX-parsed), which was never affected.

- **Worktree already contained the spec + prompt** (`docs/superpowers/specs/2026-08-07-docs-site-design.md`,
  `docs/prompts/fable-docs-site.md`), untracked. They match the run brief; treated the
  spec's decision table as settled.
- **Workspace linking confirmed**: `packages/react` → `@elirobinson/tokens` resolves as
  `link:../tokens` in pnpm-lock despite a plain `0.2.0` specifier, so `workspace:*` deps
  from apps/docs will link fine and no GH Packages auth is needed for install.
- **Root `.npmrc` auth line was inert, now removed**: pnpm 10 ignores registry credentials
  in a project `.npmrc`, so `${NODE_AUTH_TOKEN}` there did nothing. It did not affect
  publishing either — `actions/setup-node` writes a user-level npmrc (`NPM_CONFIG_USERCONFIG`)
  that pnpm does expand, which is what actually authenticates the release job. The line only
  produced a warning on every install, so it's gone; consumers use `pnpm config set`.
- **Docs consume dist, not source** (unlike Storybook): workspace dep + Nx
  `dependsOn ^build` means the site exercises the real `exports` map — the same
  resolution a consumer gets. Chosen deliberately over source aliasing.
- **One manifest, owned by `packages/react`** (`dist/manifest.json`, published as
  `@elirobinson/react/manifest`): the docs site and the ai-patterns pack step are both
  readers of it. The docs app used to run its own extractor over `packages/react/src` and
  commit the result, which made a published package's build depend on a Next.js app's
  build artifact; a CI gate existed purely to keep that committed copy honest. Both are
  gone — the manifest is a build output of the package that owns the components.
- **Turbopack MDX constraint**: Next 16 builds with Turbopack; MDX plugin options must be
  serializable, so no function-valued rehype/remark plugins. Syntax highlighting is done
  in the `pre` MDX component mapping (shiki, server-side) instead of a rehype plugin.
- **react-docgen-typescript 2.4.0 works with TypeScript 6.0.3** — the main extraction
  risk didn't materialize. Literal-union props come back as name "enum" with members in
  `type.value`; destructured defaults are extracted.
- **`ds-radio-group` styles live in `molecules/RuleLink.css`**, not a RadioGroup sheet —
  repo wrinkle, recorded as an extraction gap in the manifest rather than fixed (component
  CSS is out of scope). Input/Textarea/Select/Label share `atoms/field.css`; mapped via a
  small config block in `packages/react/scripts/manifest.mjs`.
- **Descriptions are curated, not extracted**: component source has no JSDoc descriptions,
  so `packages/react/scripts/component-descriptions.json` feeds one-liners into the
  manifest (source JSDoc wins when present). Every entry there is debt — the description
  belongs on the declaration, where it cannot drift.
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
