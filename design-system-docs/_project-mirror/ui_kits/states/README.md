# Error & empty states kit

Eight states in one sheet: 404, 500, 403, offline, two empties, loading, and inline failures.

**Rules**

- **Three beats: what happened, what it means for you, what to do next.** In that order, in sentence case.
- **Never apologise without information.** "Something broke on my side. Not your fault and nothing was lost" beats "Oops!".
- **The status code is typographic, in mono at `--fg-4`** — legible for support, quiet for everyone else. Give 500s a reference string.
- **403 names the actual reason** ("Your role is Viewer") and who can fix it.
- **Offline states say what happened to unsaved work** and when the last sync was.
- **No illustrations, no mascots, no emoji.** One primary action, at most one secondary.
