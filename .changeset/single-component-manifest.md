---
'@elirobinson/react': minor
'@elirobinson/ai-patterns': patch
---

One component manifest, owned by `@elirobinson/react`.

`./manifest` now carries everything the two extractors used to produce
separately. Alongside the existing `name` / `tier` / `subpath` /
`importSpecifier` / `exports` / `types` / `propsType` / `variants`, every
component record gains `slug`, `description`, `props` (full prop tables with
types, defaults, required flags, and per-prop JSDoc), `subComponents`, `hooks`,
`inherits`, `stylesheetPaths`, `constraints`, and `extractionGaps`; hook records
gain `description`. `manifestVersion` is `2`. `./manifest` also gains a `types`
condition, so it is a typed import rather than an `any`.

`minor` rather than `major`: every v1 field keeps its name and its meaning, so a
v1 reader keeps working. Three things do change, none of them a v1 field:

- `inherits` now names bases the previous regex-based extractor gave up on
  (`Table`, `VirtualList`, `VirtualTable`, `Accordion` said `null` and now name
  the type they extend).
- `organisms/table/core`, which exports helpers `Table` and `VirtualTable`
  share rather than a component of its own name, is no longer listed as a
  component. It was never importable as one, and the types it exports
  (`ColumnDef` and friends) are re-exported from `Table`.
- The docs-side record's `exportedTypes` is not carried over under that name —
  `types`, which the manifest already published, is the same list derived from
  the AST rather than a regex, and a superset of it.

Descriptions for components whose source carries no JSDoc still come from a
curated fallback list, which moved with the extractor to
`packages/react/scripts/component-descriptions.json`. It moved rather than being
replaced because removing it means writing JSDoc on 44 components in
`packages/react/src`, which this change deliberately does not touch; its header
now says out loud that every entry in it is debt.

`@elirobinson/ai-patterns` is a `patch`: its published output is unchanged, but
`build-artifacts.mjs` now reads `@elirobinson/react/manifest` instead of a
generated file inside `apps/docs`, so producing the tarball no longer depends on
a documentation app.
