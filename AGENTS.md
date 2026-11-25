# AI Agent Rules

Miltinson Design System monorepo — its packages are listed in [README.md](README.md#packages).

`@elirobinson/ai-elements` is the one package whose source is not ours: it is vendored from `vercel/ai-elements` at a pinned release. Do not hand-edit `packages/ai-elements/src/`: `pnpm sync:elements` treats every file there as upstream's, so a hand edit blocks the next upgrade of that file. Put changes in `scripts/ai-elements-transforms.mjs` or in a wrapper component in our own package. See [AI Elements](docs/agents/ai-elements.md).

Nothing we publish may require a consumer to update prose when this repo changes. A consumer bumps a version and is current. Anything they would otherwise have to copy into their own docs — a component list, a token table, a Tailwind mapping, a lint rule — is a bug in what we publish. Ship it as a command, a manifest, a stylesheet, or a rule instead.

> Edit `AGENTS.md`, not `CLAUDE.md`: `CLAUDE.md` is a symlink to it.

**Package manager:** pnpm (`pnpm@11.21.0`)

**Common commands:** `pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm sync:deps`

**Imports:** No barrel files — use package subpaths (`@elirobinson/react/components/atoms/Button`, `@elirobinson/tokens/tokens-data`). See `.cursor/rules/no-barrel-files.mdc`.

**Components:** Components live under `packages/react/src/components/<tier>/` (atoms/molecules/organisms/ai). Every interactive component uses `forwardRef`. Primary controls at their default size (buttons, pagination, segmented control, nav items) get at least a 44x44 touch target; dense inline affordances (chip remove, search clear, rating stars, calendar days) and compact size variants have a 24x24 floor; a grown hit area never overlaps its neighbours. [Components](docs/agents/components.md) has the tier boundary rule and the full constraints.

**Tests:** Every behaviour change ships tests and docs. Unit tests follow the test rules in [Quality bar](docs/agents/quality-bar.md).

**Work:** Each piece of work is a GitHub issue, done in its own worktree on its own feature branch. That includes subagents and side sessions that write files. See [Backlog](docs/agents/backlog.md) and [Parallel agents](docs/agents/parallel-agents.md).

## Do not

- Do not edit files in the main checkout or commit on `main`, not even a one-line doc fix. Many sessions share that checkout, and the guard hook sees only git, not an editor.
- Do not open a PR before the review gate runs: use the `review-gate` skill (`.agents/skills/review-gate/SKILL.md`). It catches what tests and lint cannot, and a hook enforces it.
- Do not skip or disable a hook (`--no-verify`, `HUSKY=0`). A failing hook means something is wrong: fix the cause. Skip one only when Eli says so. The main checkout guard's documented escape is not a skip: see [Git workflow](docs/agents/git-workflow.md).
- Do not force push or rebase a pushed branch. An issue keeps one branch and one PR; catch up with `git merge origin/main`. See [Git workflow](docs/agents/git-workflow.md#one-branch-one-pr).
- Do not use Fable for any agent: it costs too much. Use Opus, Sonnet or Haiku, and pass `model`, except to `review-*` agents, whose file pins it.
- Do not edit files another agent owns. Two agents editing one file overwrite each other.

## How we work

- [Backlog](docs/agents/backlog.md) — GitHub Issues, labels, triage, blocked-by and sub-issue links
- [Issue tracker](docs/agents/issue-tracker.md) — the tool setting and commands the agent-roster agents read
- [Parallel agents](docs/agents/parallel-agents.md) — worktrees, file ownership, messages, models, subagent briefs
- [Quality bar](docs/agents/quality-bar.md) — proof, how we build, the definition of done
- [Coordinator prompt](docs/agents/coordinator.md) — the standing prompt for the chat that runs every agent
- [CONTEXT.md](CONTEXT.md) — the glossary. [docs/adr/](docs/adr/) — the decisions and why

## Topic guides

- [Tokens](docs/agents/tokens.md)
- [Components](docs/agents/components.md)
- [Layout patterns](docs/agents/layout-patterns.md)
- [Product token layer](docs/agents/product-token-layer.md) — the optional `--product-*` override convention
- [Brand boundary](docs/agents/brand-boundary.md) — what is the system's and what is a consumer's, and the test that enforces it
- [AI Elements](docs/agents/ai-elements.md) — the vendored tier, `pnpm sync:elements`, and the transform layer
- [AI Elements accessibility](docs/agents/ai-elements-accessibility.md) — `pnpm a11y:elements`, the per-control touch-target verdicts, and what the sweep handed to the token bridge
- [AI Elements theme](docs/agents/ai-elements-theme.md) — the Miltinson × AI Elements CSS layers, the import chain, and the canvas keyboard path that gates `ai-canvas.css`
- [AI patterns](docs/agents/ai-patterns.md) — the `ds` discovery CLI, contracts, agent templates
- [Design System artifact](docs/agents/design-system-artifact.md) — `build:design-system-artifact`, which files the repo owns in the Claude artifact, and how to publish them
- [Consumer tooling](docs/agents/consumer-tooling.md) — what a consuming app installs, and why each piece lives here
- [Publishing](docs/agents/publishing.md)
- [Git workflow](docs/agents/git-workflow.md) — commit style, hooks, the Nx cache worktrees share, before/after screenshots for front-end PRs
- [Git, hooks, and pull requests](docs/agents/git-and-prs.md) — the pre-PR review gate, the pre-PR fetch, merge and cleanup
- [Visual regression](docs/agents/visual-regression.md) — what to do when a baseline passes locally and fails in CI

Brand source of truth: `design-system-docs/` (preview swatches, UI kits, agent skill).
