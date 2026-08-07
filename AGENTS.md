# AI Agent Rules

Miltinson Design System monorepo — publishes `@elirobinson/tokens`, `@elirobinson/react`, and `@elirobinson/ai-patterns`.

> Edit this file only. `CLAUDE.md` is a symlink to `AGENTS.md`.

**Package manager:** pnpm (`pnpm@10.11.1`)

**Common commands:** `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm sync:deps`

**Imports:** No barrel files — use package subpaths (`@elirobinson/react/components/atoms/Button`, `@elirobinson/tokens/tokens-data`). See `.cursor/rules/no-barrel-files.mdc`.

**Components:** Components live under `packages/react/src/components/<tier>/` (atoms/molecules/organisms). Every interactive component uses `forwardRef`. Touch targets are scoped, not blanket: >=44x44 for primary controls (buttons, pagination, segmented-control, nav items), shadcn/MUI-scale sizing for dense inline affordances (chip remove, search clear, rating stars, calendar days) — either way, an expanded hit area must never overlap sibling content. See [Components](docs/agents/components.md) for the tier boundary rule and full constraints.

## Topic guides

- [Tokens](docs/agents/tokens.md)
- [Components](docs/agents/components.md)
- [Layout patterns](docs/agents/layout-patterns.md)
- [AI patterns](docs/agents/ai-patterns.md)
- [Publishing](docs/agents/publishing.md)
- [Git workflow](docs/agents/git-workflow.md)

Brand source of truth: `design-system-docs/` (preview swatches, UI kits, agent skill).
