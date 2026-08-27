---
'@elirobinson/react': major
---

`DecisionCard` moves from `organisms/` to `molecules/`. Both of its subpaths change.

The tier is the import path, so this is the whole of the breaking change — nothing about
the component's props, markup, classes, or rendered output is different. Update two lines
and you are done.

## Migration

| what              | before                                                 | after                                                  |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| component         | `@elirobinson/react/components/organisms/DecisionCard` | `@elirobinson/react/components/molecules/DecisionCard` |
| per-component CSS | `@elirobinson/react/styles/organisms/DecisionCard.css` | `@elirobinson/react/styles/molecules/DecisionCard.css` |

```tsx
- import { DecisionCard } from '@elirobinson/react/components/organisms/DecisionCard';
+ import { DecisionCard } from '@elirobinson/react/components/molecules/DecisionCard';
```

```css
- @import '@elirobinson/react/styles/organisms/DecisionCard.css';
+ @import '@elirobinson/react/styles/molecules/DecisionCard.css';
```

If you import the aggregate `@elirobinson/react/styles.css` there is nothing to do on the
CSS side — the aggregate already points at the new path.

Anything reading `@elirobinson/react/manifest` picks the move up on its own: `tier` and
`subpath` for `DecisionCard` are derived from the directory layout, so a codegen script or
docs sidebar built on the manifest needs no edit.

## Why

The boundary rule in `docs/agents/components.md` is a mechanical test, not a preference:
a component that renders into a portal, traps focus, or manages open/closed state across
sub-elements is an organism; one assembled from 2+ atoms without such orchestration is a
molecule. `DecisionCard` does none of the three — it has no hooks at all — and composes a
single `VerdictBadge`. It was in `organisms/` because that is where #88 created the
directory, and nothing checked the rule against the directory afterwards.

Something does now: `packages/react/scripts/tier-boundary.test.mjs` sweeps `organisms/`
and fails on any component that neither orchestrates itself nor composes something that
does. `VirtualTable` passes on the second half — no hooks of its own, but it renders
`VirtualList` — and `DecisionCard` was the only file that failed. That is what stops the
next one from costing another major.
