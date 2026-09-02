---
---

Removes the `.design-sync/` pipeline. Its target — the `Miltinson Design System (Code)`
project on claude.ai/design — no longer exists: `get_project` on it returns HTTP 404 and
`list_projects` shows only the brand-kit project. The deleted project took `_ds_sync.json`
with it, which was the only carry-forward anchor, so nothing about the pipeline was
recoverable — a re-run would have been a first-time import of 50 components and 99
stories into a new project.

Gone: `.design-sync/` (config, NOTES, conventions, `gen-entry.mjs`, `sync.mjs`), the
`.gitignore` and `eslint.config.mjs` entries covering its scratch directories, and
`packages/react/index.d.ts`.

That last file existed only so the converter had one `.d.ts` to read the component roster
from — the package deliberately ships no barrel and no `"."` export, and `index.d.ts` sat
in the package root where `files: ["dist","src", …]` excludes it. With no converter, it is
a barrel-shaped file with no consumer, so the published tarball is unchanged and this
changeset is empty on purpose.

The header comment in `build-design-project.mjs` no longer contrasts itself against the
removed pipeline. The reasoning it carried is worth more than the name, so it is restated
directly: a push to that project must emit a subset and delete nothing, because the
guidelines, ui_kits, templates, slides and patterns there have no source in this repo and
a wholesale regenerate would take them out.
