---
'@elirobinson/ai-elements': minor
---

New package: `@elirobinson/ai-elements`, AI Elements vendored from
[`vercel/ai-elements`](https://github.com/vercel/ai-elements) at release
`ai-elements@1.9.0` (`bc871264341cf54a7ea1fee36d951688ed2a1ff7`).

It is a separate package rather than an addition to `@elirobinson/react` because
`@elirobinson/react` has no UI dependencies at all, and Elements needs Tailwind v4,
shadcn/ui, Radix and `lucide-react`. Folding them in would force Tailwind on every
consumer of `Button` and `Input` for a feature most will not use. Installing this
package is how a consumer opts into that requirement instead.

Per-component subpaths, no barrel: `./components/*` (48 AI Elements), `./ui/*` (25
shadcn/ui primitives they are built on), `./lib/*`. What exists and what each subpath
exports is published as `./manifest`, regenerated from the emitted declaration files on
every build; the upstream pin is published as `./upstream`. Neither is restated in prose
anywhere, so neither can go stale.

The vendored tree is Apache-2.0. The package ships `LICENSE`, a `NOTICE` crediting
Vercel and enumerating the modifications, and a generated provenance header on every
file naming the upstream release and that file's upstream path.

Maintainers re-pull with `pnpm sync:elements`. Every vendored file is upstream's bytes
plus the two transforms in `scripts/ai-elements-transforms.mjs` and nothing else, which
is what lets the check attribute each difference it finds: upstream moved, or a vendored
file was edited. When both are true of one file it exits non-zero and writes nothing,
rather than silently reverting the local change.

**Peer note.** The peers are `react`/`react-dom` `^19`, `tailwindcss` `^4`, `ai`
`^6.0.105` and `@ai-sdk/react` `^3.0.41`. The `ai` peer is v6, not v7: `ai@7`
restructured `LanguageModelUsage` (`reasoningTokens` and `cachedInputTokens` moved into
`outputTokenDetails`/`inputTokenDetails`), and `components/context.tsx` at the pinned
release reads the v6 shape. `ai-elements@1.9.0` is upstream's newest tagged release and
still declares `ai: ^6.0.105` itself. `sync:elements` diffs upstream's dependency ranges
against the lockfile on every run, so the move to v7 surfaces as a `DEP` line the day
upstream makes it.
