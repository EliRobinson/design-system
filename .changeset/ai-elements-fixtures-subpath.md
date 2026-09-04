---
'@elirobinson/ai-elements': minor
---

Publish the reference fixtures as `@elirobinson/ai-elements/fixtures`.

One realistic mount per vendored component, keyed by the component's name in
the manifest and imported through the package's own published subpaths. They
were already written — the accessibility audit runs on them — and they were
reachable only from inside this repo. Exporting them gives the docs site and a
consuming app the same mounts the audit measures, so a demo cannot drift from
what was actually verified.
