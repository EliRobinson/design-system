---
'@elirobinson/ai-patterns': patch
---

`ds check`'s `container-widths` trap now tells you to upgrade `@elirobinson/tokens` to 1.0.0, which renames the shell widths `--shell-*` (#250). It still flags an app on an older install. The adoption guides and the adherence check name `--shell-*`.

`ds-resync migrate` no longer rewrites a line that declares a renamed token's old name. It lists it for you instead. That name can belong to another library: `--container-md` in a Tailwind `@theme` block is Tailwind's.
