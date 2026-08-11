# AI patterns

`@elirobinson/ai-patterns` is the package consumers install to find out what the design
system offers and what rules their UI has to satisfy. It ships no runtime code — a CLI,
some Markdown, a JSON contract file, and test helpers.

## Working principles

- Keep patterns in `@elirobinson/ai-patterns/patterns` and UX contracts in `@elirobinson/ai-patterns/contracts` — no package root barrel.
- Enforce practical tone and avoid hype language in generated copy.
- Follow `packages/ai-patterns/src/contracts.json` for touch targets, focus-visible, and WCAG AA contrast.
- `ds-resync` (`packages/ai-patterns/src/resync/`) brings a consuming repo's `@elirobinson/*`
  deps up to date: `pnpm dlx @elirobinson/ai-patterns ds-resync` reports, `--write` applies.
  The agent-facing instructions ship at `@elirobinson/ai-patterns/resync/skill`.

## Two bins, two questions

The package ships both, and they are easy to confuse:

| Bin                           | Answers                                           |
| ----------------------------- | ------------------------------------------------- |
| `elirobinson-ds` (`src/cli/`) | "What does the version I have installed offer?"   |
| `ds-resync` (`src/resync/`)   | "Am I behind, and what changed while I was away?" |

`ds-resync` reads the registry and rewrites dependency ranges. `elirobinson-ds` never
touches the network — it only describes what is already in `node_modules`. A consumer runs
`ds-resync` occasionally and `ds` constantly.

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
