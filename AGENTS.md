# AI Agent Rules

Miltinson Design System monorepo — publishes `@elirobinson/tokens`, `@elirobinson/react`, `@elirobinson/ai-patterns`, and `@elirobinson/eslint-config`.

**Nothing we publish may require a consumer to update prose when this repo changes.** A consumer bumps a version and is current. Anything they would otherwise have to copy into their own docs — a component list, a token table, a Tailwind mapping, a lint rule — is a bug in what we publish. Ship it as a command, a manifest, a stylesheet, or a rule instead.

> Edit this file only. `CLAUDE.md` is a symlink to `AGENTS.md`.

**Package manager:** pnpm (`pnpm@11.21.0`)

**Common commands:** `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm sync:deps`

**Imports:** No barrel files — use package subpaths (`@elirobinson/react/components/atoms/Button`, `@elirobinson/tokens/tokens-data`). See `.cursor/rules/no-barrel-files.mdc`.

**Components:** Components live under `packages/react/src/components/<tier>/` (atoms/molecules/organisms). Every interactive component uses `forwardRef`. Touch targets are scoped, not blanket: >=44x44 for primary controls (buttons, pagination, segmented-control, nav items), shadcn/MUI-scale sizing for dense inline affordances (chip remove, search clear, rating stars, calendar days) — either way, an expanded hit area must never overlap sibling content. See [Components](docs/agents/components.md) for the tier boundary rule and full constraints.

## Topic guides

- [Tokens](docs/agents/tokens.md)
- [Components](docs/agents/components.md)
- [Layout patterns](docs/agents/layout-patterns.md)
- [AI patterns](docs/agents/ai-patterns.md) — the `ds` discovery CLI, contracts, agent templates
- [Consumer tooling](docs/agents/consumer-tooling.md) — what a consuming app installs, and why each piece lives here
- [Publishing](docs/agents/publishing.md)
- [Git workflow](docs/agents/git-workflow.md)

Brand source of truth: `design-system-docs/` (preview swatches, UI kits, agent skill).
