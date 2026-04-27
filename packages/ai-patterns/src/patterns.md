# AI Product Patterns

## 1) Ask, Then Act
- Ask one concise clarifying question only when critical context is missing.
- Otherwise execute and show progress incrementally.

## 2) Explain Decisions, Not Just Diffs
- Include why token/component choices were made.
- Tie rationale to brand voice and accessibility requirements.

## 3) Safe Defaults
- Prefer semantic tokens over hardcoded values.
- Ship keyboard-first interactions and visible focus states by default.

## 4) Reusable Prompts
- Prompt templates should include intent, constraints, and verification checklist.
- Keep all prompts in repo-controlled files for auditability.
