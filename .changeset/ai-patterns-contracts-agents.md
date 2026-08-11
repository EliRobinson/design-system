---
'@elirobinson/ai-patterns': minor
---

Make the contracts executable and ship the agent-instruction surfaces.

- New `@elirobinson/ai-patterns/testing/playwright`: `checkTouchTargets`,
  `checkHitAreaOverlap`, `checkFocusVisible`, `checkContrast` and
  `expectDesignSystemContracts` for the `uiContracts` only a browser can settle. Touch
  targets are measured as the _effective_ hit area, so a small glyph expanded with padding
  or a bounded overlay passes. `@playwright/test` and `axe-core` are optional peers.
- New `@elirobinson/ai-patterns/agents/*`: a Claude Code skill, a Cursor rule, Copilot
  instructions, and an `AGENTS.md` block, installed by `ds init --agents`. None of them
  contains an inventory — they point at `ds`. The `AGENTS.md` fragment merges between
  markers so a consumer's own content survives a re-run.
- `contracts.json` gains a `verifiedBy` for every entry, naming the lint rule or test
  helper that enforces it — or saying plainly that it is review-only. Two constraints the
  system always implied are now stated: `no-foreign-component-libraries` and
  `no-hardcoded-design-values`. Existing keys keep their existing types;
  `uiContracts.verifiedBy` is a sibling map, so `uiContracts.minimumTouchTarget` is still
  the string `"44x44"`.
- `patterns.md` gains **Discover, Don't Document** and **Definition of Done for UI work**,
  plus integration notes for the two traps that fail silently: `next-themes` defaulting to
  a `class` strategy the stylesheet never looks at, and Tailwind utilities resolving to
  nothing without the token bridge.
- The `adopt-system` prompt now starts by wiring up the tooling — CLI, ESLint config,
  Tailwind bridge, agent files, contract tests — before migrating any screen.
