# @elirobinson/ai-patterns

## 0.3.0

### Minor Changes

- 96092e7: Add prompt templates and extend the machine-checkable contracts.

  Three prompt templates ship under `./prompts/*` (new export): adding a
  component to the system, adopting the system in an existing app, and
  auditing a page for token/accessibility compliance. Each follows the
  existing `patterns.md` house style — intent, constraints, verification
  checklist — and is rendered on the new documentation site's "Build with
  AI" page.

  `contracts.json` gains a `componentConstraints` block so the constraints
  that previously lived only in prose (`docs/agents/components.md`) are
  machine-checkable: the scoped touch-target policy, the `forwardRef`
  requirement, the tier boundary rule, and the no-barrel-imports import
  convention. All existing keys (`systemPromptStyle`, `uiContracts`) are
  unchanged.

## 0.2.0

### Minor Changes

- 52b1b6d: Remove root barrel exports. Import token data from `@elirobinson/tokens/tokens-data` and AI patterns from `@elirobinson/ai-patterns/patterns` or `./contracts`.

## 0.1.1

### Patch Changes

- 60e0c53: Publish design system packages to the GitHub Packages npm registry.
