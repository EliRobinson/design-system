---
'@elirobinson/ai-patterns': minor
---

New `ds check` command. It finds the known traps that make an app look wrong with no error, and prints the issue number, the file and the exact fix for each:

- `font-override` (#34): `next/font` is used and nothing sets `--ds-font-sans-override`, so the page renders in the system font.
- `layered-token-override` (#34): a design token is re-declared inside `@layer` or `@theme`, where it loses to `tokens.css`.
- `layered-import` (#34): the design system stylesheet is imported with `layer(…)`, so Preflight or Tailwind utilities land on the wrong side of the components.
- `container-widths` (#250): Tailwind's `max-w-sm` … `max-w-2xl` and friends are used while the installed `tokens.css` re-declares `--container-*`.
- `old-install` (#78, #103, #112, #251, #126): the installed `@elirobinson/react` or `@elirobinson/tokens` predates the fix for a silent bug.
- `stale-artifacts` (#257, #270): `.claude/ds-artifacts.json` was written for other versions than the installed ones.
- `token-copy`: a hand copy of `tokens.css` in the repo that differs from the installed one.

It warns and exits 0. Pass `--strict` to exit 1 on any warning. `--dir <path>` checks another folder. `ds init --agents`, the agent instruction files and the `ds-migrate` patterns now tell agents to run it after setup and after every upgrade.
