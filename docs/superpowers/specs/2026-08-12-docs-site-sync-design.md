# Design: keep the documentation site in sync with the design system

**Date:** 2026-08-12
**Packages:** `@elirobinson/ai-patterns` (brand manifest, MCP server), `apps/docs`
**Also touches:** repo root (`vercel.json`), `.github/workflows/`

## Problem

The docs site derives its component data correctly and its brand data not at all, and as a
website it does not update, because nothing deploys it.

Three findings, in descending order of severity.

**The site is never deployed from this repo.** There is no Vercel, Netlify, or Pages
configuration and no deploy workflow. `quality.yml` builds the site on every PR and push
and discards the output; `release.yml` publishes packages only. The Vercel project that
serves the site is configured entirely in the Vercel dashboard — Root Directory
`apps/docs`, with both the install and build commands overridden to `cd ../.. && …`.
Nobody reading this repo can tell how the site builds, the configuration cannot be
reviewed in a pull request, and it can drift from the repo silently. That is the same
failure this repo's `AGENTS.md` bans for consumers — "nothing we publish may require a
consumer to update prose when this repo changes" — applied to our own infrastructure.

**Non-component content is hand-maintained and has already drifted.** Component
inventory, props, tiers, and constraints all derive from `@elirobinson/react/manifest`,
and token values are parsed live from the published `tokens.css`. But prose counts are
written by hand, and **three are already wrong**: the installation page advertises six
interaction hooks against seven shipped, the AI page says roughly 120 tokens against 153,
and the homepage claims three published packages against four. The sidebar's Foundations,
Patterns, and Guidelines sections are hardcoded lists in `site-map.ts` — as are two further
copies of the same section list in `app/page.tsx` and `SiteHeader.tsx` — so a new pattern
page is invisible until someone edits all of them, and a sidebar entry whose MDX is missing
yields a 404. The test that ought to catch a component with no page — "gives every
component a page in the sidebar" in `apps/docs/src/lib/manifest.test.ts` — compares the
manifest against a sidebar built from that same manifest, so it can never fail.

**`design-system-docs/` is invisible to the site.** The brand source of truth — guideline
cards, UI kits, templates, slides, assets, and the voice rules — reaches _consumers_
through the packed `.claude/skills/miltinson-design/` artifact that
`packages/ai-patterns/scripts/build-artifacts.mjs` stages. It reaches _humans on the docs
website_ not at all. The site's own Guidelines section is four hand-written MDX pages
covering a subset of the same ground, with no link between them.

## Approach

**One spine, many projections.** The component layer already works this way and is the
model for the rest: `packages/react` generates exactly one manifest, and the sidebar,
props tables, search index, `/r/<slug>.json`, `/llms.txt`, and the packed skill are all
readers of it. Nothing restates it.

The brand layer fails to reach the site because it has no spine — it is a folder of
hand-authored HTML whose index is a Markdown table maintained by hand between
`<!-- ds-artifacts:managed -->` markers. So the fix is not to pick a rendering strategy for
it; the fix is to give it a manifest, and then let the site be one more reader.

| Spine                                | Owned by               | Status  |
| ------------------------------------ | ---------------------- | ------- |
| `@elirobinson/react/manifest`        | `packages/react`       | exists  |
| `tokens.css` + `parse-tokens-css`    | `packages/tokens`      | exists  |
| `@elirobinson/ai-patterns/contracts` | `packages/ai-patterns` | exists  |
| `brand-manifest.json`                | `packages/ai-patterns` | **new** |

Projections, all of which read and never produce: the docs site, the packed skill
artifact, and a new MCP server.

### What this deliberately does not do

**No shadcn registry compatibility.** It was considered and rejected. shadcn's registry is
a source-distribution model: `add` copies component source into the consumer's repo, which
they then own and edit, and which never updates again. This repo publishes versioned
packages behind an exports map, and `AGENTS.md` opens with the opposite commitment — a
consumer bumps a version and is current. A `files[]` array pointing at source a consumer
should not copy would misrepresent how the system is distributed, and `cssVars` assumes a
Tailwind theme rather than the `tokens.css` this system ships. `/r/<slug>.json` keeps its
present shape as a documentation record.

**No rebuilding of brand HTML as React components.** The guideline cards and UI kits are
brand artifacts. Rendering the real file is the point — a reproduction is a second copy
that can drift from the first.

## Deployment

`vercel.json`, committed at the repo root, replacing both dashboard command overrides:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm exec nx run docs:build",
  "outputDirectory": "apps/docs/.next"
}
```

Vercel reads `vercel.json` from the project's Root Directory and it takes precedence over
dashboard settings, so this is a drop-in. Root Directory moves from `apps/docs` to the
repo root, which is what removes the `cd ../..`: `nx` needs `nx.json` and the project
graph, so the build genuinely is a workspace-root operation, and the current configuration
sets the root one level too deep and then climbs back out.

The commands then match `quality.yml` exactly, which is the actual prize — the site builds
the same way CI verifies it, rather than by a second recipe that happens to agree.

`nx run docs:build` already builds `react`, `tokens`, and `ai-patterns` first: `nx.json`
sets `dependsOn: ["^build"]` in `targetDefaults`, and `apps/docs/project.json` declares
`implicitDependencies: ["react", "tokens"]`. No `@elirobinson/*` dependency resolves to the
registry — every one is a `link:` workspace entry — so the build needs no registry auth.

Verified during design: `nx run docs:build` succeeds from a clean worktree, and **every
route is static** (`○ Static` or `● SSG`; no server-rendered routes). The `readFileSync`
calls in `tokens-css.ts` and `ai-corpus.ts` therefore run at build time, where `cwd` is
`apps/docs` and the files are present. This is worth stating because it makes the site a
pure build-time projection of the packages: every deploy re-derives everything.

That property is currently unguarded, and one page turning dynamic would move those reads
into a serverless function where neither the workspace `node_modules` nor the MDX sources
are traced into the bundle. A test asserting the build emits no server-rendered routes
turns a production-only failure into a CI failure.

### Gating production on Quality

`release.yml` refuses to publish unless Quality passes, but the Vercel Git integration
ships to production on any push where `next build` succeeds — including one where lint,
typecheck, or tests failed. Preview deployments should stay on the Git integration, since
per-PR previews are worth having unconditionally. Production should be gated the way
publishing already is: set `git.deploymentEnabled` to `false` for the default branch in
`vercel.json`, and add a `deploy.yml` triggered on Quality success against `main` that
promotes the build, mirroring the `workflow_run` pattern `release.yml` already uses.

## Structural drift guards

These close the gap between "a package changed" and "the site is correct". They land first
because they are small and they fail loudly.

An audit of `apps/docs` found the coverage sets are currently _clean_: manifest slugs,
`app/(docs)/components/<slug>/` directories, and `src/components/demos/<slug>/` directories
are 44/44/44 with no gaps in either direction. Guard 1 is therefore preventive. The prose
counts are a different story — three are already wrong.

### 1. Every component has a page and demos

Replace the assertion at `apps/docs/src/lib/manifest.test.ts:29` — _"gives every component
a page in the sidebar"_ — which is tautological: `hrefs` comes from `allPages()` →
`siteSections()` → `site-map.ts:47-49`, which maps over the same `components` array with
the same `` `/components/${c.slug}` `` template. Both sides derive from
`manifest.components`, it touches no filesystem, and it cannot fail for any manifest.

The replacement checks disk: for every component in the manifest,
`app/(docs)/components/<slug>/page.mdx` exists and `src/components/demos/<slug>/` holds at
least one demo. The same tautology exists in the loop body of `ai-corpus.test.ts:96`
(`expect(record?.docs).toBe(...)` compares `componentRecord`'s output against the identical
template built from the same slug); its `toHaveLength(44)` assertion is a real tripwire and
stays.

### 2. Counts and inventories derive from source

Three are live bugs today:

| Location                    | Claims               | Actual                       |
| --------------------------- | -------------------- | ---------------------------- |
| `installation/page.mdx:47`  | 6 interaction hooks  | 7                            |
| `build-with-ai/page.mdx:16` | ~120 tokens          | 153 unique custom properties |
| `app/page.tsx:63`           | 3 published packages | 4 carry `publishConfig`      |

The last is the clearest illustration: it sits in a `stats` array whose other three entries
are correctly computed from `components.length`, `hooks.length`, and `cssTokens()`.

Also hardcoded, and correctable the same way: `app/page.tsx:34` and
`components/page.tsx:21` ("All 44 components"), where both files already import the
manifest and use it correctly elsewhere.

`tokens-css.test.ts:6` asserts only `length > 110` against an actual 153, so 42 tokens
could be deleted silently; its name still says "roughly 120". Tighten it to compare against
the parsed count rather than a floor.

### 3. Hand-keyed maps must cover the manifest

Two lookup tables are keyed by manifest identifiers and degrade silently when those change:

- `components/hooks/page.tsx:10` — `USED_BY`, a hand-kept map of all seven hook names to
  prose naming their consumers. Read guarded at line 43, so a renamed hook silently loses
  its usage note.
- `components/page.tsx:8` — `TIER_INTRO`, keyed by tier. Read _unguarded_ at line 32, so a
  new tier renders an empty paragraph.

Neither needs to become generated — the prose is editorial. They need a test asserting the
key set equals the manifest's hook and tier sets, so a rename fails CI.

### 4. One section list, derived from the filesystem

The site's section list exists in three hand-kept copies: `site-map.ts:26-79`,
`app/page.tsx:25-56` (`SECTIONS`, with its own prose inventories), and
`SiteHeader.tsx:6-12` (`NAV`, with hardcoded entry hrefs). `siteSections()` becomes the one
source; the other two derive from it.

`siteSections()` in turn builds Foundations, Patterns, and Guidelines by reading the
`page.mdx` files present under each directory rather than from hardcoded arrays, taking
each title from the page's exported metadata. Adding a pattern becomes adding one file.
Editorial ordering comes from an explicit order field in that metadata, not array position.

### 5. Referential integrity across hand-written references

None of these are broken today; none are guarded, and each fails silently rather than
loudly:

- **`RelatedComponents`** — 220 slug references across the 44 component pages.
  `RelatedComponents.tsx:6-8` silently `.filter()`s out unknown slugs, so a component
  rename quietly empties the related list.
- **Every `siteSections()` href resolves to a real page file.** This would flag
  `/components/hooks`, which is served by `page.tsx` rather than `page.mdx`.
- **Every `page.mdx` on disk is reachable from some section.** This would flag `/components`
  (`components/page.tsx`), which is absent from `siteSections()` and therefore missing from
  the sidebar _and_ from command-palette search, since `SiteHeader.tsx:32` feeds the search
  index from `allPages()`. It is linked from the header and homepage, which is exactly why
  the omission went unnoticed.

`DemoBlock` needs no guard: `DemoBlock.tsx:10` does a bare `readFileSync`, so a missing demo
is already a build failure.

### 6. The corpus reads only `page.mdx`

`ai-corpus.ts:41-43` (`pagePath`) looks exclusively for `page.mdx`, and `pageProse` returns
`null` for anything else, which `sectionProse` then filters out silently. The interaction
hooks page is a `page.tsx`, so its prose is structurally invisible to `/llms-full.txt`
today. Either the page becomes MDX or `pagePath` learns to fall back — but the silent
filter must become a loud one, so a page that cannot be read is reported rather than
dropped.

`ai-corpus.ts:133` also hardcodes the section titles `'Foundations'` and `'Patterns'`, and
`sectionProse` returns `[]` for an unknown title, so renaming a section in `site-map.ts`
empties the corpus prose with no error.

## Brand manifest

`build-artifacts.mjs` already walks `design-system-docs/` and computes a sha256 per staged
file. It gains a second output, `brand-manifest.json`, describing every artifact in the
folder — 114 files across ten categories.

### What the inventory found, and what it forces

Four findings shape the record:

**Generated and hand-authored cards are indistinguishable on disk.** Eleven of the 21
`guidelines/*.html` cards are emitted by `guideline-cards.mjs` from tokens; ten are
editorial writing. Both sets carry the same `@dsCard` marker, are minified identically, and
link the same stylesheet. The only authority is the eleven `cards.push({ path })` literals
in that module. **The manifest generator must import `buildGuidelineCards` and read the
paths it emits** — a hardcoded list would be exactly the drift this whole spec removes, and
file inspection cannot recover the distinction. That roster already has a second consumer
in `pushBoundary`, so importing it makes three.

**Three stylesheet conventions, none normalisable by find-replace.** `guidelines/` links
`../styles.css`; `preview/` links a sibling `_card.css`; `slides/`, `ui_kits/`, and
`patterns/social-carousel/` link `colors_and_type.css` at varying depths. The manifest
records each artifact's dependencies as written rather than assuming one shape.

**Two paths escape the folder.** `colors_and_type.css` is a _symlink_ to
`packages/tokens/src/tokens.css` — `find -type f` misses it entirely, so any walker must
use `readdirSync(…, { withFileTypes: true })` and record `symlinkTarget`. And the generated
`styles.css` `@import`s 44 component stylesheets at `../packages/react/src/components/**`.

**Standalone-renderability is per-file, not per-directory.** All 16 `preview/` cards render
cleanly against only `_card.css`. But three _hand-authored_ guideline cards do not:
`focus.html` needs `Button.css`, `spacing-in-use.html` needs `Card.css`, and
`type-mono.html` needs `Kbd.css`, all reached through `styles.css`. The four `ui_kits/`
render only over an **HTTP origin** — their `<script type="text/babel" src="…">` fetches
are CORS-blocked under `file://` — and need `unpkg.com` plus `'unsafe-eval'` for in-browser
Babel.

### Record shape

One record per _artifact_, not per file, because a UI kit is an entry point plus sources
plus a README and only the entry point renders:

```jsonc
{
  "id": "guidelines/colors-ink",
  "path": "guidelines/colors-ink.html",
  "category": "guideline-card",
  "title": "Ink scale",
  "group": "Colors",
  "origin": "generated",
  "generatedBy": "packages/ai-patterns/src/artifacts/guideline-cards.mjs",
  "ships": false,
  "shipReason": "BRAND_SOURCES does not list \"guidelines\"",
  "members": [{ "path": "…", "role": "entry|doc|source|vendored" }],
  "render": {
    "standalone": true,
    "requiresHttpOrigin": false,
    "externalOrigins": ["fonts.googleapis.com"],
    "viewport": { "width": 700, "height": 140 },
    "blockedBy": [],
  },
  "sha256": "…",
}
```

`category` ∈ `brand-doc | tokens | aggregate-stylesheet | guideline-card | preview-card |
ui-kit | slide | pattern | asset | support-file | scratch`.
`origin` ∈ `generated | hand-authored | vendored | mirrored | incidental` — `vendored`
exists for `patterns/invoice/doc-page.js` and the four copies of
`_project-mirror/templates/*/support.js`, which must never be linted or reviewed.

`ships` derives from `BRAND_SOURCES` in `build-artifacts.mjs`, which is a pure allow-list —
`['colors_and_type.css', 'assets', 'ui_kits']` — so "not listed" is the entire exclusion
rule and `shipReason` cites it.

### The README index table becomes generated in-repo

`renderIndexTable(BRAND_INDEX)` runs only at pack time and writes to `dist/`. **The in-repo
table between the `ds-artifacts:managed` markers is still hand-maintained, and has
drifted.** Generating it in place from the brand manifest fixes three live errors at once:

| Row               | Problem                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `templates/`      | **The directory does not exist.** It was renamed `patterns/`. The stale name also survives in the `build-artifacts.mjs` header comment and in the design-project `SKILL.md` prose.                                |
| `slides/`         | Names five templates including "comparison". Four exist; `slides/index.html` itself says "Four 16:9 templates."                                                                                                   |
| `ui_kits/webapp/` | Claims "auth". That kit exports `Sidebar`, `TopBar`, `StatCard`, `ProjectsTable` only — the auth kit is in `_project-mirror/`, which does not ship. This same claim also reaches consumers through `BRAND_INDEX`. |

The table also omits six top-level entries that exist on disk, including `guidelines/` — 21
cards, the single largest omission — and `_project-mirror/`, which is 91% of the folder's
bytes.

## Docs site brand sections

`src/lib/brand.ts` reads the brand manifest exactly as `manifest.ts` reads the component
one. New sidebar sections — Brand, UI Kits, Resources — render from it, with each artifact
shown as a live `<iframe>` of the real file and badged shipped or repo-only.

Three mechanics follow from the inventory:

1. **Copy preserving relative structure.** A build step copies manifested artifacts into
   `public/brand/`, keeping directory depth intact so `../styles.css`, `_card.css`, and
   `../../colors_and_type.css` all still resolve. `colors_and_type.css` is copied
   dereferenced, as `build-artifacts.mjs` already does.
2. **Flatten `styles.css`.** Its 44 `@import`s point outside the folder. Emit a resolved
   copy into `public/brand/` at build time rather than mirroring `packages/react/src`.
   Without this the three component-dependent guideline cards render unstyled.
3. **UI kits need HTTP and a CSP allowance.** Serving from `public/` satisfies the origin
   requirement. The iframes need `script-src` for `unpkg.com` and `'unsafe-eval'`, scoped to
   those routes only — not applied site-wide.

Viewports come from the `@dsCard viewport` attribute where present. `preview/` and `slides/`
carry no such attribute; `preview/_card.css` pins `width: 700px` and slides are fixed
1280×720, so those two are recorded in the manifest generator rather than parsed.

`_project-mirror/` is manifested with `origin: "mirrored"` but not rendered: all 13 of its
entry points load a `_ds_bundle.js` that was deliberately not copied, so every one renders
blank. It is also expected to shrink to zero as kits are ported, and `countKitDirs` already
derives that count — so nothing may hardcode nine.

## Brand layer in the AI corpus

`llms.mjs` gains an optional `brand` input, keeping the single-generator rule. Both
`/llms-full.txt` and the packed snapshot then carry the brand voice rules from `README.md`
and the shipped kit and asset inventory. Today an agent asked to build a Miltinson page
gets prop tables and tokens and no voice guidance at all.

Only `ships: true` artifacts enter the packed snapshot. The site's corpus may include
repo-only artifacts, marked as such.

## Defects found during design, not in scope

These are real and worth tracking; none block this work, and I have not folded them in.

- **`assets/logo-wordmark.svg` and `logo-wordmark-dark.svg` do not render as the wordmark.**
  Both reference CSS classes (`wm-text`, `wm-dot`) inside an empty `<defs>` that defines
  nothing, and the two files are byte-identical apart from a leading newline — the "dark"
  variant is not white-text as `README.md` claims. These two ship to consumers, and
  `SKILL.md` instructs every agent to use them. This is the most serious defect found.
- **`patterns/invoice/invoice.html` renders blank.** It declares
  `doc-page:not(:defined) { visibility: hidden }` but never loads `doc-page.js`. Its README
  claims the pair render standalone.
- **`ui_kits/_shared/Primitives.jsx` ships undocumented.** The packer's consistency check
  compares only first path segments, so `_shared/` is invisible to it.
- **`uploads/pasted-1777227214382-0.png` is a stray chat screenshot**, not brand material.

## MCP server

The `elirobinson-ds` CLI already answers "what does the version I have installed offer?"
by reading `node_modules` at run time. An MCP server is that same query surface exposed to
an agent _while it writes code_, which is the moment the answer matters. It reads the
installed packages and never the network, so it inherits the CLI's central property: it
cannot go stale, and it removes the `STALE SNAPSHOT` failure class rather than detecting
it. This is the purest expression of the rule at the top of `AGENTS.md` — the consumer
bumps a version and every prop table, token, and constraint the agent sees is current, with
no prose to copy.

### The SDK moved — do not build on remembered APIs

The monolithic `@modelcontextprotocol/sdk` package has been **retired**. It was replaced by
split packages in SDK v2, released alongside the `2026-07-28` spec revision.

|              | v1 (legacy)                                       | v2 (build on this)                       |
| ------------ | ------------------------------------------------- | ---------------------------------------- |
| Package      | `@modelcontextprotocol/sdk` (`1.30.0`)            | `@modelcontextprotocol/server` (`2.0.0`) |
| Stdio        | `new StdioServerTransport()` + `server.connect()` | `serveStdio(factory)`                    |
| Registration | `.tool()` / `.resource()`                         | `registerTool` / `registerResource`      |
| Errors       | `McpError` / `ErrorCode`                          | `ProtocolError` / `ProtocolErrorCode`    |

Requires Node 20+ (this repo is on 24) and `import * as z from 'zod/v4'` — not bare `zod`.
Use the high-level `McpServer`, not the low-level `Server`; both exist in v2 and the
low-level one performs no argument validation. **The SDK repo's own README still shows the
v1 `StdioServerTransport` wiring** while `docs/serving/stdio.md` says to use `serveStdio` —
follow the docs, not the README.

Export a server _factory_, not an instance: `serveStdio` takes a factory, and the same
factory is what the in-process test harness drives.

### Its own package, not a third bin in `ai-patterns`

`@elirobinson/design-system-mcp`, a new published package with a single `bin`.

`ai-patterns` deliberately ships no runtime dependencies — "a CLI, some Markdown, a JSON
contract file, and test helpers" — and an MCP server brings the SDK and Zod with it. More
decisively, `docs/agents/ai-patterns.md` documents at length that this package's two bins
already make `pnpm dlx <pkg> <bin>` fail with `ERR_PNPM_DLX_MULTIPLE_BINS`, which is why
every documented invocation must name the package explicitly. A third bin deepens a problem
the repo has already paid for. A single-bin package sidesteps it entirely.

### Tools, not resources — and why that is forced

MCP offers tools (model-controlled), resources (application-controlled), and prompts
(user-invoked). **In Claude Code, resources require an explicit `@` mention** —
`@server:protocol://resource/path` — so a resource is inert unless a human types `@` and
picks it. An agent writing a component will never spontaneously read one.

A design system needs to be consulted at exactly the moment no human is choosing context.
So every primary surface is a tool. Brand voice and the full constraint set are _mirrored_
as resources, for a human pulling them into a review conversation.

The cost is real and worth stating: every tool's name, description, and schema enters the
model's context on every request. That argues for few, sharply-bounded tools — roughly five
— and for consolidating what would otherwise be chained calls.

| Tool                 | Returns                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `get_component`      | Props, variants, sub-components, _and_ applicable constraints in one call        |
| `search_tokens`      | Token name, resolved value, and comment; filterable by prefix; default limit ~20 |
| `get_constraints`    | UX contracts from `contracts.json`, scoped by component                          |
| `get_brand_guidance` | Voice rules and the relevant UI-kit pointers for a named surface                 |
| `check_adherence`    | Runs the existing `adherence.mjs` checks over a snippet                          |

`get_component` is deliberately one call rather than `get_component` → `get_props` →
`get_variants`: every unresolved identifier returned is a round trip forced on the agent.

### Error text is a model-facing API

A tool failure is a **successful** JSON-RPC result carrying `isError: true`; the model reads
the text and recovers. A thrown exception is converted into the same shape. This has two
consequences the implementation must honour:

- Every failure message enumerates the valid alternatives. `No token "brand-primary".
Prefixes: --ink-, --signal-, --anchor-, --space-, --radius-.` lets the agent retry;
  `Not found` does not.
- Tests must assert on the resolved value, never `try/catch`. A `try/catch`-based test
  passes forever regardless of behaviour.

### stdout is the protocol channel

A single `console.log` anywhere in the process — or in a dependency — emits a line the host
cannot parse as JSON-RPC and the connection drops. Log to `console.error`. This warrants a
`no-console` rule in `@elirobinson/eslint-config` scoped to the package, since the failure
is silent and total.

For the same reason the in-repo `.mcp.json` entry invokes `node` against the built file
directly rather than going through `pnpm --filter … exec`: pnpm writes lifecycle noise to
stdout and would corrupt the channel.

### Testing

Two layers, per the SDK's own testing guide:

- **Assertions**: drive a real `Client` against `createMcpHandler(createServer)` in
  process — no port, no spawn, no mock — and assert on tool results including `isError`
  cases. This drops into the existing Vitest suite. Note `InMemoryTransport.createLinkedPair()`
  is documented as connecting 2025-era instances only; use the handler.
- **Packaging**: exactly one spawned-stdio smoke test. It is the only thing that catches a
  broken shebang, a missing executable bit, or a stray `console.log`, none of which the
  in-process harness can see.

### Open question: private-registry distribution

The `@elirobinson` scope is restricted on GitHub Packages, and the standard consumer
invocation is `npx -y @elirobinson/design-system-mcp` from `.mcp.json`. That resolves auth
from the consumer's `.npmrc`, which fresh clones and CI environments frequently lack, and
the failure surfaces as an opaque connection error rather than an auth error.

Publishing _this one package_ publicly would remove an entire class of consumer setup
failure while the rest of the scope stays restricted — it contains no proprietary content,
only a query interface over packages the consumer must already be authenticated to install.
**This needs an explicit decision before implementation.**

## Sequencing

Deployment and the drift guards are independent of everything else and land first. The
brand manifest unblocks both the site's brand sections and the corpus extension. The MCP
server reads every spine and so comes last.

1. Deployment — `vercel.json`, production gating, static-routes assertion
2. Structural drift guards — the six guards above
3. Brand manifest — including the generated in-repo README table
4. Docs site brand sections
5. Brand layer in the AI corpus
6. MCP server

### What can run in parallel

Three waves, not six serial steps. Within a wave the work touches disjoint files:

- **Wave A — 1 and 2 together.** Deployment touches `vercel.json` and
  `.github/workflows/`; the drift guards touch `apps/docs/src`. No overlap.
- **Wave B — 3 alone.** Both remaining waves read the brand manifest, so its shape has to
  settle first.
- **Wave C — 4, 5, and 6 together.** The site's brand sections are `apps/docs/src`; the
  corpus extension is `packages/ai-patterns/src/artifacts/llms.mjs`; the MCP server is a
  new package. Disjoint, and each has its own tests.

The one shared edge is that guard 4 (deriving sections from the filesystem) rewrites
`siteSections()`, and the brand sections in wave C add to it. Landing wave A first keeps
that from being a conflict.

## Open decisions

Two things need a human answer before or during implementation:

1. **Private-registry distribution for the MCP package** — see that section. Publishing
   this one package publicly removes a class of consumer setup failure.
2. **Whether the four out-of-scope defects get their own follow-up**, in particular the two
   wordmark SVGs, which ship to consumers today and do not render as the wordmark.
