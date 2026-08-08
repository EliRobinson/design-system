---
'@elirobinson/ai-patterns': minor
---

Add prompt templates and extend the machine-checkable contracts.

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
