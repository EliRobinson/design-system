# Consumer tooling

Everything a consuming app needs in order to build on this design system, and stay on it.
All of it lives here rather than in each consumer, because a copy in a consumer repo drifts
from the packages independently and every new consumer rebuilds it by hand.

## What a consumer installs

```bash
pnpm add @elirobinson/react@latest @elirobinson/tokens@latest
pnpm add -D @elirobinson/ai-patterns@latest @elirobinson/eslint-config@latest @elirobinson/design-system-mcp@latest
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

| Piece                                                                               | Package                                | Replaces, in a consumer                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `elirobinson-ds` CLI                                                                | `ai-patterns` (`bin`)                  | A hand-written script that parses our directory layout and our `.d.ts` output                                    |
| `manifest.json`                                                                     | `react` (`./manifest`)                 | Regex-parsing `dist/**/*.d.ts` to find components and variants                                                   |
| `tailwind.css`                                                                      | `tokens`                               | A hand-maintained `@theme inline` block mapping ~80 colour aliases\*                                             |
| Flat ESLint config: `@elirobinson/eslint-config` + `@elirobinson/eslint-config/css` | `eslint-config`                        | Hand-written lint rules, or more often no check at all. `pnpm ds contracts` names each rule and what it verifies |
| Playwright contract helpers                                                         | `ai-patterns` (`./testing/playwright`) | Nothing — most consumers never check the runtime contracts                                                       |
| Visual regression preset + sweeps                                                   | `ai-patterns` (`./testing/visual-*`)   | A copied `playwright.config.ts` and a hand-kept list of what to snapshot                                         |
| Agent templates                                                                     | `ai-patterns` (`./agents/*`)           | Four near-identical instruction files per repo, each aging separately                                            |
| `ds-resync` CLI                                                                     | `ai-patterns` (`bin`)                  | Noticing by hand that a repo is several releases behind                                                          |
| `ds-resync artifacts`                                                               | `ai-patterns` (`bin`)                  | A copy of the brand skill and a hand-written component cheatsheet per repo                                       |
| `ds-resync migrate`                                                                 | `ai-patterns` (`bin`)                  | Deriving the same token find/replace out of changelog prose by hand, in every consuming repo, every release      |
| `design-system-mcp` server                                                          | `design-system-mcp` (`bin`)            | An agent guessing props from memory instead of querying the installed package                                    |
| Dial roster (`./dials`)                                                             | `tokens`                               | A copied table of palettes, themes and platforms, wrong on the next palette                                      |

`ds-resync migrate` reads its instructions from a manifest the changed package ships —
`src/migrations.json`, authored beside the stylesheets it describes and checked against them
by that package's own test, so it cannot describe a token the package no longer has. The
consumer's `node_modules` copy is the one that runs, so the manifest a repo migrates against
is always the version it just installed. Any future breaking change should arrive in that
shape: a manifest entry a command can act on, not a changelog paragraph every consumer
re-reads and re-derives.

The MCP server is its own single-bin package, wired in `.mcp.json` as
`node node_modules/@elirobinson/design-system-mcp/src/bin.mjs` — `node` directly, because
pnpm's lifecycle output would corrupt the stdio JSON-RPC channel, and a single bin because
`pnpm dlx <pkg> <bin>` cannot select between `ai-patterns`' two. It reads the project's
installed `@elirobinson/*` packages at call time, so it inherits the CLI's core property:
it cannot go stale. See `packages/design-system-mcp/README.md` for the consumer wiring.

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
- **No claim a consumer's own config can falsify.** A template that states which severity a
  rule runs at, or which options a repo passed, is false for every repo configured
  differently — and the consumer cannot correct it, because `ds init --agents --force`
  rewrites the file. Name a shipped default as a default, and carry the knob that changes
  it. `cli.test.mjs` holds the copy rule to this (#82).
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
- **Every tracked manifest names the shipped version.** `pnpm sync:deps` sweeps every
  manifest in the pnpm workspace _and_ `templates/**/package.json`, and
  `manifest-versions.test.mjs` in `ai-patterns` fails when either falls behind.
  `templates/` is outside the workspace, so nothing installs it and drift has nowhere else
  to surface — it went unnoticed there from `^0.1.0` to `@elirobinson/react` 2.x. The
  scaffolder rewrites those ranges when it generates an app, so a stale template is inert
  on that path, but the template is also copied by hand, and then the declared ranges are
  all a reader gets. Workspace manifests sync to an exact pin; template manifests keep
  their caret, which is what `create-elirobinson-design-system` writes.
- **A contract without a check is a comment.** Adding an entry to `contracts.json` means
  shipping its `verifiedBy` — a lint rule or a Playwright helper — or stating plainly that
  it is review-only.

## The dials

`tokens.css` resolves under three independent attributes on the root element, and a
consumer who cannot query them is a consumer who writes them into their own docs — where
a third palette makes every copy wrong at once and nothing fails. So the roster ships as
data, and every surface reads it rather than restating it:

| Surface                           | Answers                                                         |
| --------------------------------- | --------------------------------------------------------------- |
| `ds dials`                        | The three dials, the combinations, and what moves on a platform |
| `ds tokens [filter]`              | A token's value in every combination it differs in              |
| MCP `get_dials` / `search_tokens` | The same, for an agent mid-task                                 |
| `@elirobinson/tokens/dials`       | The roster as a module, for anything that generates             |

One list exists, in `packages/tokens/src/contrast.mjs`, and `dials.mjs` re-exports it.
Adding a palette means a block in `palettes.css` and an entry in that list; every surface
above widens with no further edit, and `dials.test.mjs` fails if the two ever disagree in
either direction.

Two rules for anything new that reports a token value:

- **Name the combination.** A value is only meaningful inside one — `--accent` is amber in
  `ember` and teal in `slate`. Combinations are written `<palette>/<theme>`, everywhere,
  and `ember/light` is what a root element with no attributes renders.
- **The platform is a third axis, not a fifth combination.** `mobile.css` declares no
  colour, deliberately, so `data-platform` is orthogonal to the four colour combinations.
  Report what it re-points as an override on top of them, never as more columns.
