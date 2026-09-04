# AI Agent Rules

Miltinson Design System monorepo — publishes `@elirobinson/tokens`, `@elirobinson/react`, `@elirobinson/ai-elements`, `@elirobinson/ai-patterns`, `@elirobinson/eslint-config`, and `@elirobinson/design-system-mcp`.

`@elirobinson/ai-elements` is the one package whose source is not ours: it is vendored from `vercel/ai-elements` at a pinned release. Never hand-edit `packages/ai-elements/src/` — see [AI Elements](docs/agents/ai-elements.md).

**Nothing we publish may require a consumer to update prose when this repo changes.** A consumer bumps a version and is current. Anything they would otherwise have to copy into their own docs — a component list, a token table, a Tailwind mapping, a lint rule — is a bug in what we publish. Ship it as a command, a manifest, a stylesheet, or a rule instead.

> Edit this file only. `CLAUDE.md` is a symlink to `AGENTS.md`.

**Package manager:** pnpm (`pnpm@11.21.0`)

**Common commands:** `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm sync:deps`

**Imports:** No barrel files — use package subpaths (`@elirobinson/react/components/atoms/Button`, `@elirobinson/tokens/tokens-data`). See `.cursor/rules/no-barrel-files.mdc`.

**Components:** Components live under `packages/react/src/components/<tier>/` (atoms/molecules/organisms/ai). Every interactive component uses `forwardRef`. Touch targets are scoped, not blanket: >=44x44 for primary controls (buttons, pagination, segmented-control, nav items), shadcn/MUI-scale sizing for dense inline affordances (chip remove, search clear, rating stars, calendar days) — either way, an expanded hit area must never overlap sibling content. See [Components](docs/agents/components.md) for the tier boundary rule and full constraints.

## Topic guides

- [Tokens](docs/agents/tokens.md)
- [Components](docs/agents/components.md)
- [Layout patterns](docs/agents/layout-patterns.md)
- [Product token layer](docs/agents/product-token-layer.md) — the optional `--product-*` override convention
- [Brand boundary](docs/agents/brand-boundary.md) — what is the system's and what is a consumer's, and the test that enforces it
- [AI Elements](docs/agents/ai-elements.md) — the vendored tier, `pnpm sync:elements`, and why `src/` is never hand-edited
- [AI Elements accessibility](docs/agents/ai-elements-accessibility.md) — `pnpm a11y:elements`, the per-control touch-target verdicts, and what the sweep handed to the token bridge
- [AI patterns](docs/agents/ai-patterns.md) — the `ds` discovery CLI, contracts, agent templates
- [Consumer tooling](docs/agents/consumer-tooling.md) — what a consuming app installs, and why each piece lives here
- [Publishing](docs/agents/publishing.md)
- [Git workflow](docs/agents/git-workflow.md) — commit style, the Nx cache worktrees share, before/after screenshots for front-end PRs
- [Visual regression](docs/agents/visual-regression.md) — what to do when a baseline passes locally and fails in CI

Brand source of truth: `design-system-docs/` (preview swatches, UI kits, agent skill).
