# @elirobinson/ai-elements

AI Elements, vendored from [`vercel/ai-elements`](https://github.com/vercel/ai-elements)
at a pinned release and published to the same restricted registry as the rest of the
design system.

## Why this is not part of `@elirobinson/react`

`@elirobinson/react` has no UI dependencies — `@elirobinson/tokens` and two TanStack
packages, and that is all. Elements needs Tailwind v4, shadcn/ui, Radix and
`lucide-react`. Putting them in `@elirobinson/react` would force Tailwind on every
consumer of `Button` and `Input`, for a feature most of them will not use.

Installing this package is how a consumer opts into that requirement.

## Install

```bash
pnpm add @elirobinson/ai-elements@latest
```

Peers are declared in `package.json` and enforced by your package manager, so they are
not restated here. The Tailwind v4 one is load-bearing: every component is Tailwind
utility markup, and without the framework it renders unstyled.

## Import

There is no barrel. Each component is its own subpath:

```tsx
import { Message, MessageContent } from '@elirobinson/ai-elements/components/message';
import { Button } from '@elirobinson/ai-elements/ui/button';
import { cn } from '@elirobinson/ai-elements/lib/utils';
```

`components/*` is AI Elements, `ui/*` the shadcn/ui primitives it is built on, `lib/*`
its helpers. **What exists, and what each subpath exports, is data, not documentation:**

```bash
node -p "require('@elirobinson/ai-elements/manifest').entries.map(e => e.subpath).join('\n')"
```

The manifest is regenerated from the emitted declaration files on every build, so it
cannot name a component the package does not ship. Nothing here lists components in
prose, and nothing downstream should either.

## Provenance and licensing

The vendored tree is Apache-2.0. `LICENSE` carries the licence text, `NOTICE` carries
the attribution and the complete list of modifications, and every file under `src/`
opens with a header naming the upstream release and its own upstream path. The pin
itself is `elements.lock.json`, also published, as `@elirobinson/ai-elements/upstream`:

```bash
node -p "require('@elirobinson/ai-elements/upstream').upstream.ref"
```

Every one of those is generated from the same source of truth, so none of them can
drift from the code.

## Re-syncing (maintainers)

```bash
pnpm sync:elements                  # check the pin against the newest upstream release
pnpm sync:elements --write          # vendor it and re-pin
pnpm sync:elements --ref <tag|sha>  # target a specific upstream ref
```

The vendored files are upstream's bytes plus the transforms in
`scripts/ai-elements-transforms.mjs`, and nothing else. That is what lets the check
attribute every difference it finds: upstream moved, or somebody edited a vendored
file. When both are true for the same file it exits non-zero and writes nothing,
rather than silently reverting the local change.

So do not edit anything under `src/`. A change we need goes in the transform layer,
where it is re-applied on every bump and reviewable as one file.
