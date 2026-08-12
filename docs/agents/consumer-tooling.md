# Consumer tooling

Everything a consuming app needs in order to build on this design system, and stay on it.
All of it lives here rather than in each consumer, because a copy in a consumer repo drifts
from the packages independently and every new consumer rebuilds it by hand.

## What a consumer installs

```bash
pnpm add @elirobinson/react@latest @elirobinson/tokens@latest
pnpm add -D @elirobinson/ai-patterns@latest @elirobinson/eslint-config@latest
```

```jsonc
// package.json
"scripts": { "ds": "elirobinson-ds" }
```

```js
// eslint.config.mjs
import designSystem from '@elirobinson/eslint-config';
export default [...designSystem()];
```

```css
/* app entry stylesheet, Tailwind v4 */
@import 'tailwindcss';
@import '@elirobinson/tokens/tokens.css';
@import '@elirobinson/tokens/tailwind.css';
```

Then `pnpm ds init --agents` for the agent instruction files,
`pnpm exec ds-resync artifacts --write` for the skills, and
`expectDesignSystemContracts` from `@elirobinson/ai-patterns/testing/playwright` in the E2E
suite. `pnpm exec ds-resync` keeps the versions current afterwards, and
`ds-resync artifacts` re-run keeps the skills in step with them.

The step-by-step version of all this lives in the repo README, under **Adopt the design
system in an app**.

## The pieces, and why each is here

| Piece                                             | Package                                | Replaces, in a consumer                                                       |
| ------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `elirobinson-ds` CLI                              | `ai-patterns` (`bin`)                  | A hand-written script that parses our directory layout and our `.d.ts` output |
| `manifest.json`                                   | `react` (`./manifest`)                 | Regex-parsing `dist/**/*.d.ts` to find components and variants                |
| `tailwind.css`                                    | `tokens`                               | A hand-maintained `@theme inline` block mapping ~30 colour aliases\*          |
| Flat ESLint config + `no-hardcoded-design-values` | `eslint-config`                        | Hand-written lint rules, or more often no check at all                        |
| Playwright contract helpers                       | `ai-patterns` (`./testing/playwright`) | Nothing — most consumers never check the runtime contracts                    |
| Agent templates                                   | `ai-patterns` (`./agents/*`)           | Four near-identical instruction files per repo, each aging separately         |
| `ds-resync` CLI                                   | `ai-patterns` (`bin`)                  | Noticing by hand that a repo is several releases behind                       |
| `ds-resync artifacts`                             | `ai-patterns` (`bin`)                  | A copy of the brand skill and a hand-written component cheatsheet per repo    |

\* **Except the two font lines.** A `next/font` app's `@theme inline` block usually carries
`--font-sans: var(--font-geist-sans)` and its mono twin, and deleting the block on the
strength of this row is what silently drops the typeface — the bridge maps the family from
`tokens.css`, whose literal `'Geist'` never matches the hashed family `next/font` actually
loaded. Those two lines move to the override hook rather than disappearing:

```css
:root {
  --ds-font-sans-override: var(--font-geist-sans);
  --ds-font-mono-override: var(--font-geist-mono);
}
```

Unlayered, and with the font class on `<html>` so the variable is visible at `:root`. Colour
and radius aliases have no such carve-out; those the bridge really does replace.

## Rules for changing any of it

- **No inventories in prose.** If a doc, template, or comment lists components, tokens, or
  props, it is wrong as of the next release. Point at `ds`.
- **Layout-agnostic discovery.** The CLI and the manifest generator walk the tree; neither
  may assume a directory structure. Both have tests that build a flat layout and a tiered
  one and assert identical behaviour.
- **Additive only.** Existing export subpaths keep working. New capability arrives as a new
  subpath, a new bin, or a new optional export. The one exception is a subpath that resolves
  to something it was never meant to serve — a wildcard wide enough to hand out files of a
  kind its name does not describe. Narrowing that is allowed, but it is a breaking change and
  ships as a major with the resolution failure spelled out in the changeset, never as a
  quiet fix. (`./styles/*` → `./styles/*.css` in `@elirobinson/react` v2 is the worked
  example: the old pattern served raw `.tsx` source through a path named "styles".)
- **Nothing synced into a consumer is hand-maintained there.** Everything `ds init` and
  `ds-resync artifacts` write is regenerable by re-running the command. Re-running must
  never destroy a local edit: `ds-resync artifacts` records a sha256 of every file it
  writes in `.claude/ds-artifacts.json`, updates only files that still match, and reports
  the rest.
- **A contract without a check is a comment.** Adding an entry to `contracts.json` means
  shipping its `verifiedBy` — a lint rule or a Playwright helper — or stating plainly that
  it is review-only.
