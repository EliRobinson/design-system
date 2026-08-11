---
'@elirobinson/ai-patterns': minor
---

`ds-resync artifacts` syncs the design system's agent guidance into a consuming repo.
Three skills land under `.claude/skills/`: the Miltinson brand skill, a version-stamped
component reference (`llms.txt` / `llms-full.txt` covering every component, prop table,
token, and machine-checkable constraint), and the `ds-resync` instructions themselves.
Read-only by default; `--write` applies.

The package now has a real build/`prepack` step that stages all of it into the tarball,
so none of this depends on a docs site that is not deployed anywhere. The `/llms-full.txt`
URLs in `resync/skill`, `prompts/audit-page`, and `prompts/add-component` — which never
resolved — now point at what actually ships.

Re-running is safe by construction. Every file written is recorded with its sha256 in
`.claude/ds-artifacts.json`; a file that still matches is updated, and a file you have
edited is left exactly as you left it and named in the report. `--force` takes the shipped
copy instead.

Each artifact carries the `@elirobinson/react` version it was generated against, and the
command warns loudly when that is not the version the repo has installed — a snapshot that
silently describes a different release is how an agent ends up with confidently wrong prop
tables. `--fail-on-drift` turns that into exit 2 for CI.
