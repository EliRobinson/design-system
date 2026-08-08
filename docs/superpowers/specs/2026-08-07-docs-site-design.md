# Design: documentation site + AI layer for the Miltinson Design System

**Date:** 2026-08-07
**Branch:** `feat/docs-site` (worktree at `../design-system-docs-site`)
**Deliverable of this session:** the one-shot prompt at `docs/prompts/fable-docs-site.md`.
The site itself is built by executing that prompt.

## Problem

The design system publishes three packages and 44 components, but the only running
artifact is Storybook. Storybook shows a component in isolation; it does not carry
foundations, adoption guidance, when-to-use judgment, or anything an agent can read
mechanically. The system reads as a component library rather than a design system.

## Approach

Add `apps/docs` — a Next.js App Router + MDX site — plus a machine-readable AI layer
derived from the same source as the human-readable docs.

### Site

Nx project alongside `apps/storybook` (`project.json` with `dev`/`build`/`lint`/`test`,
`implicitDependencies: ["react", "tokens"]`). Sections: Overview, Foundations, Components
(one page per component), Patterns, Guidelines, Build with AI.

Styled with the design system's own tokens and components. No third-party docs framework
— dogfooding is the point, and a framework theme would fight the brand.

### Extraction pipeline (the load-bearing decision)

One build-time step over `packages/react/src/components/**` emits a single
`component-manifest.json` carrying name, tier, import subpath, stylesheet subpath, props,
sub-components, and constraints per component.

That manifest feeds three consumers: rendered props tables, the search index, and the AI
artifacts. No downstream consumer hand-maintains a second copy.

**Why it matters:** the failure mode for a design system's AI surface is silent drift —
`llms.txt` claiming a prop that was renamed three releases ago, and an agent confidently
writing broken code against it. Deriving every surface from one extraction makes drift
structurally impossible rather than a thing someone has to remember.

### AI layer

`/llms.txt` and `/llms-full.txt` route handlers, `/r/[component].json` per-component
records, prompt templates written into `packages/ai-patterns/src/prompts/` (so they ship
with the published package), and `contracts.json` extended so prose-only constraints
(touch-target policy, `forwardRef` rule, tier boundary, no-barrel-files) become
machine-checkable.

## Decisions and rationale

| Decision                                     | Alternative rejected                    | Why                                                                                                                                                                   |
| -------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace dependency on `@elirobinson/react` | Install the published GH Packages build | Docs track HEAD; no `NODE_AUTH_TOKEN` in CI. The published install flow is documented on the installation page instead. Matches Radix/shadcn/Chakra in-repo practice. |
| Next.js App Router + custom MDX              | Fumadocs / Nextra / Starlight           | The generator already scaffolds Next.js App Router, so the docs site doubles as the reference consumer app. A framework's theme layer would compete with the tokens.  |
| Single manifest feeding three surfaces       | Separate generators per surface         | Eliminates drift between docs and AI artifacts by construction.                                                                                                       |
| Prompt written goal-first, not step-by-step  | Explicit ordered checklist              | Fable 5 degrades on over-prescriptive prompts written for earlier models; the guidance is to state outcome, constraints, and verification, then get out of the way.   |
| Prompts live in `packages/ai-patterns`       | Prompts live only in the docs site      | They ship with the published package and are versioned, rather than being site content.                                                                               |

## Non-goals

No changes to `packages/react` component source; no Tailwind or CSS-in-JS; no changes to
`apps/storybook`; no publishing, version bumps, or changesets; no reorganization of
`docs/agents/` or `design-system-docs/` beyond one `SKILL.md` cross-link.

## Verification

`pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm format:check`
green from the repo root with `apps/docs` in the Nx graph; production build succeeds;
`llms.txt` / `llms-full.txt` non-empty with import paths that resolve.

## Known repo wrinkles recorded during design

- `packages/tokens/src/tokens.css` base-color comment says "electric lime"; the signal
  color is Miltinson Amber. Values are correct, comment is stale.
- `tokens.css` loads Geist and JetBrains Mono from Google Fonts via `@import`, which the
  file's own comment flags as a placeholder for licensed `.woff2` files.
