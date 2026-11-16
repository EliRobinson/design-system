---
'@elirobinson/ai-patterns': patch
---

The AGENTS.md block and the Claude skill, Cursor rule and Copilot instructions written by `init --agents` now use calmer, plainer wording: no "Never", no stacked bold, no em dashes, and each rule said once with a short reason. The rules, commands and facts are unchanged, except that the Tailwind v4 CSS-entry order (`tailwindcss`, then the design system stylesheet, then `tokens/tailwind.css`) is now stated in one place, for every Tailwind v4 app. Re-run `init --agents --force` to refresh files written by an earlier version.
