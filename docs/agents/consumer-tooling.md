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

Then `pnpm ds init --agents` for the agent instruction files, and
`expectDesignSystemContracts` from `@elirobinson/ai-patterns/testing/playwright` in the E2E
suite. `pnpm exec ds-resync` keeps the versions current afterwards.

The step-by-step version of all this lives in the repo README, under **Adopt the design
system in an app**.

## The pieces, and why each is here

| Piece                                             | Package                                | Replaces, in a consumer                                                       |
| ------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `elirobinson-ds` CLI                              | `ai-patterns` (`bin`)                  | A hand-written script that parses our directory layout and our `.d.ts` output |
| `manifest.json`                                   | `react` (`./manifest`)                 | Regex-parsing `dist/**/*.d.ts` to find components and variants                |
| `tailwind.css`                                    | `tokens`                               | A hand-maintained `@theme inline` block mapping ~30 colour aliases            |
| Flat ESLint config + `no-hardcoded-design-values` | `eslint-config`                        | Hand-written lint rules, or more often no check at all                        |
| Playwright contract helpers                       | `ai-patterns` (`./testing/playwright`) | Nothing — most consumers never check the runtime contracts                    |
| Agent templates                                   | `ai-patterns` (`./agents/*`)           | Four near-identical instruction files per repo, each aging separately         |
| `ds-resync` CLI                                   | `ai-patterns` (`bin`)                  | Noticing by hand that a repo is several releases behind                       |

## Rules for changing any of it

- **No inventories in prose.** If a doc, template, or comment lists components, tokens, or
  props, it is wrong as of the next release. Point at `ds`.
- **Layout-agnostic discovery.** The CLI and the manifest generator walk the tree; neither
  may assume a directory structure. Both have tests that build a flat layout and a tiered
  one and assert identical behaviour.
- **Additive only.** Existing export subpaths keep working. New capability arrives as a new
  subpath, a new bin, or a new optional export.
- **A contract without a check is a comment.** Adding an entry to `contracts.json` means
  shipping its `verifiedBy` — a lint rule or a Playwright helper — or stating plainly that
  it is review-only.
