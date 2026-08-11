---
'@elirobinson/ai-patterns': minor
'@elirobinson/react': major
---

One llms corpus generator, owned by `@elirobinson/ai-patterns`.

The generator that renders `llms.txt` and `llms-full.txt` existed twice, written
independently and producing the same format: once in `apps/docs` for the live
`/llms.txt` routes, once in this package for the snapshot that ships in the
tarball. `INTRO` and the import rules were duplicated character for character;
the prop tables, component sections, and index were reimplemented. Both files
opened with a comment asserting the other was its twin, which is not a mechanism
— they had already drifted.

There is now one implementation, published as `@elirobinson/ai-patterns/corpus`
(`llmsIndex`, `llmsFull`, `versionStamp`, `RESYNC_COMMAND`), with a hand-written
`llms.d.ts` and a drift test against it, matching how `./testing/playwright` is
published. It is parameterized by the four things that genuinely differ between
the two callers, each optional and absent by default:

- `versions` — stamps the output as a snapshot. The docs site passes none.
- `prose` — the Foundations and Patterns pages, as plain markdown.
- `componentAppendix` — extra blocks per component section; the docs site
  appends the page prose and a `/r/<slug>.json` link.
- `alsoAvailable` — the "what else is here" bullets, which are URLs on a website
  and filenames plus a CLI in a tarball.

The packed snapshot is byte-identical to what it produced before. The docs
`/llms-full.txt` gains exactly one trailing newline, so neither a file nor a
`text/plain` body ends mid-line.

Two fixes that only became possible once there was one reader:

- Component order is driven off `manifest.tiers` rather than a hardcoded
  `['atoms', 'molecules', 'organisms']` in each copy. A tier added to
  `@elirobinson/react` used to drop every component in it out of the corpus
  silently; it now appears, and a component the manifest gives no tier is
  emitted after the tiers rather than discarded.
- `@elirobinson/react`'s manifest drops `importPath`, which was a byte-identical
  alias of `importSpecifier` published only so the docs site and the `ds` CLI
  could each keep their own name for it. `importSpecifier` is the one name.

Removing a published manifest field is breaking, so `@elirobinson/react` is
marked `major`. It is already taking a `major` in this batch, and the field
being removed was introduced in this same unreleased batch, so no released
reader ever saw it — but the manifest is a published contract and the bump
should say what happened to it rather than what it cost.
