# AI Elements demo surface — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every vendored AI Elements component a rendered, deterministic demo on the docs site, and settle C1 by adopting Elements' `Conversation` and `Message` over our own.

**Architecture:** A11y's existing fixture module is promoted out of `packages/ai-elements/a11y/` into a built, publicly exported `./fixtures` subpath, so one roster feeds both the accessibility audit and the docs site. `apps/docs` gains Tailwind 4 in a stylesheet of its own. A static fixture route outside the `(docs)` group renders one fixture per page for the visual suite; seven family pages inside `(docs)` carry the human-readable documentation.

**Tech Stack:** pnpm 11.21.0, Nx, Next 16 (App Router, MDX), React 19, Tailwind 4, Vitest, Playwright, Changesets.

**Spec:** `docs/superpowers/specs/2026-09-04-ai-elements-demo-surface-design.md`

## Global Constraints

- **Never hand-edit `packages/ai-elements/src/**`.** Every modification goes through `scripts/ai-elements-transforms.mjs`, which runs `ai-elements-patches/a11y.mjs`then`skin.mjs`, in that order. `pnpm sync:elements --pinned` must exit 0 at the end of every task that touches the vendored tree.
- **Never touch `packages/tokens/src/tokens.css`.** Two tests in two packages pin its `@layer base` behaviour. Playwright lives only in `packages/tokens`.
- **Never weaken `apps/docs/src/lib/ai-elements.test.ts`.** Extend it. It resolves specifiers in a real Node subprocess because an in-process check silently passes on everything, including `react`.
- **No barrel files.** Subpath imports only.
- **No `@/` imports outside the docs app's own tsconfig.** The root `pnpm typecheck` has no `@/` alias.
- **Any change under `packages/` needs a changeset** in `.changeset/*.md`, and it must be `git add`ed to count. Changes confined to `apps/docs` do not.
- **Never propose publishing any `@elirobinson` package publicly.** The registry is restricted, deliberately.
- **Commit messages end with:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Working directory:** `/Users/elirobinson/Code/design-system/.claude/worktrees/agent-af97a88e2d7b9b88f`, branch `docs/ai-elements-section`. Add to PR #228. Do not open a new PR. Do not merge.
- **`next build` hides CSS warnings on stderr and behind a warm `.next`.** Any claim about CSS is made against a build with `.next` removed first.

## One deliberate deviation from the spec

The spec proposes setting `reducedMotion: 'reduce'` on the visual projects. This
plan does not, and freezes motion on the route instead
(`<MotionConfig reducedMotion="always">` plus a scoped stylesheet).

`reducedMotion` on a Playwright project applies to every shot that project takes,
which is all ~87 existing docs baselines — a change to unrelated shots, made to
serve 48 new ones. Freezing on the route is deterministic (it does not depend on
a browser setting the container may not carry) and touches nothing that already
has a baseline.

The tree-wide `prefers-reduced-motion` guard the vendored components lack is a
real gap and stays a real gap. It is not silently folded in here — it belongs to
the transform layer and to its own card.

## File structure

| Path                                                                | Responsibility                                                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/docs/postcss.config.mjs`                                      | Create. Registers `@tailwindcss/postcss`.                                                                                                         |
| `apps/docs/src/app/elements.css`                                    | Create. The three-import Tailwind bridge plus `@source`. Separate from `site.css` so a Tailwind regression cannot be read as a chrome regression. |
| `packages/ai-elements/fixtures/index.tsx`                           | Move from `a11y/fixtures/index.tsx`. Exports `fixtures` (unchanged) and `variants` (new).                                                         |
| `packages/ai-elements/fixtures/variants.tsx`                        | Create. The named extra mounts, split out so `index.tsx` does not grow past what fits in context.                                                 |
| `packages/ai-elements/tsconfig.fixtures.json`                       | Create. `rootDir: ./fixtures`, `outDir: ./dist/fixtures`. Kept out of the main tsconfig, whose `rootDir` is `./src`.                              |
| `apps/docs/src/app/fixtures/ai-elements/[component]/page.tsx`       | Create. One static page per fixture. **Outside `(docs)`**, so it never reaches the sidebar or the section guard.                                  |
| `apps/docs/src/lib/ai-element-families.ts`                          | Create. Family → component names, in the shape `NAMEABLE` already uses.                                                                           |
| `apps/docs/src/app/(docs)/components/ai-elements/<family>/page.mdx` | Create ×7. The demo pages.                                                                                                                        |
| `apps/docs/src/components/docs/ElementsPatchTable.tsx`              | Create. Renders the patch verdicts from `contracts.json`, generated not retyped.                                                                  |
| `scripts/ai-elements-patches/a11y.mjs:79`                           | Modify. Two patch entries for `conversation.tsx`.                                                                                                 |
| `packages/react/src/components/ai/ChatThread.tsx`                   | Modify. `@deprecated` JSDoc.                                                                                                                      |
| `packages/react/src/components/ai/ChatMessage.tsx`                  | Modify. `@deprecated` JSDoc.                                                                                                                      |

---

### Task 1: Tailwind 4 in the docs app

**Files:**

- Create: `apps/docs/postcss.config.mjs`
- Create: `apps/docs/src/app/elements.css`
- Modify: `apps/docs/package.json` (add `@tailwindcss/postcss`, `tailwindcss`)
- Modify: `apps/docs/src/app/layout.tsx:5` (import the new stylesheet)

**Interfaces:**

- Consumes: nothing.
- Produces: Tailwind utilities compiled for `@elirobinson/ai-elements/src`. Every later task that renders a vendored component depends on this.

- [ ] **Step 1: Prove the baseline fails first**

The whole point of this task is a claim about CSS, and `next build` hides CSS warnings. Establish that the suite can see a failure before trusting a pass.

```bash
rm -rf apps/docs/.next
pnpm nx run docs:build 2>&1 | tail -20
```

Expected: a clean build, **87 static routes**. Record the number; Task 4 changes it and the change must be explained.

- [ ] **Step 2: Add the dependencies**

```bash
pnpm --filter docs add -D @tailwindcss/postcss tailwindcss
pnpm sync:deps
```

Expected: `sync-workspace-deps: workspace deps and lockfile are in sync`.

- [ ] **Step 3: Create the PostCSS config**

`apps/docs/postcss.config.mjs`:

```js
/* Tailwind 4 for the vendored AI Elements tier, and nothing else.

   The docs site's own chrome is hand-written CSS in site.css against
   @elirobinson/tokens, and stays that way. Tailwind is here because
   @elirobinson/ai-elements is Tailwind v4 markup — it is the consumer's
   framework, declared as a peer of that package, and a page that mounts a
   vendored component without it renders unstyled with no error at all. */
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
```

- [ ] **Step 4: Create the bridge stylesheet**

`apps/docs/src/app/elements.css`. The import order is the one `@elirobinson/tokens/tailwind.css` documents at the top of its own file, and it is the same order `packages/ai-elements/a11y/harness/harness.css` uses — that file is the proof this combination works.

```css
/* The stylesheet a consumer of @elirobinson/ai-elements is told to write.

   Three imports in the order @elirobinson/tokens/tailwind.css documents, which
   is what makes a vendored component render in Miltinson colours with no edit
   to its source: `@theme inline` maps Tailwind's colour, radius, shadow and
   font namespaces onto the tokens, so `bg-background` and `rounded-md` compile
   to `var(--token)` and answer to all three dials at runtime.

   A file of its own, never an addition to site.css. site.css is the docs
   chrome and its cascade is load-bearing for every existing baseline; keeping
   the two apart means a Tailwind regression cannot be mistaken for a chrome
   regression, in either direction. */
@import 'tailwindcss';
@import '@elirobinson/tokens/tokens.css';
@import '@elirobinson/tokens/tailwind.css';

/* Tailwind scans source files for class names. The vendored tree is in another
   package and its utilities are the entire reason this file exists, so it has
   to be named explicitly. A @source that matches nothing produces no error and
   no utilities — see the verification step in the plan. */
@source '../../../../packages/ai-elements/src';
```

- [ ] **Step 5: Import it from the root layout**

In `apps/docs/src/app/layout.tsx`, after the existing `./site.css` import:

```tsx
import '@elirobinson/tokens/tokens.css';
import '@elirobinson/react/styles.css';
import './site.css';
import './elements.css';
```

- [ ] **Step 6: Verify the `@source` actually matched something**

This is the step that catches the silent failure. A `@source` pointing at nothing compiles happily and emits no utilities.

```bash
rm -rf apps/docs/.next
pnpm nx run docs:build
grep -rl "is-assistant\|group-\[.is-user\]" apps/docs/.next/static/chunks/ | head
```

Expected: at least one CSS file listed. **If nothing is listed the `@source` path is wrong** — pnpm symlinks the workspace package, so resolve the real path with `node -p "require.resolve('@elirobinson/ai-elements/package.json')"` from `apps/docs` and re-point it. Do not proceed until this grep matches.

- [ ] **Step 7: Verify the existing cascade is untouched**

```bash
pnpm nx run-many -t test --projects=docs,tokens,react
```

Expected: all pass. The two tests pinning `tokens.css`'s `@layer base` behaviour are among them.

- [ ] **Step 8: Commit**

```bash
git add apps/docs/postcss.config.mjs apps/docs/src/app/elements.css apps/docs/src/app/layout.tsx apps/docs/package.json pnpm-lock.yaml
git commit -m "$(cat <<'MSG'
build(docs): compile Tailwind 4 for the vendored tier

The docs site had no Tailwind at all, so nothing on it could render an
AI Elements component — the worked examples are read off disk and shown
as source, never mounted.

A stylesheet of its own rather than an addition to site.css. The chrome's
cascade is load-bearing for every existing baseline, and keeping the two
apart means a Tailwind regression cannot be read as a chrome regression.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Promote the fixture module

**Files:**

- Move: `packages/ai-elements/a11y/fixtures/index.tsx` → `packages/ai-elements/fixtures/index.tsx`
- Create: `packages/ai-elements/tsconfig.fixtures.json`
- Modify: `packages/ai-elements/package.json` (`exports`, `build` script)
- Modify: `packages/ai-elements/a11y/harness/main.tsx:14` (import path)
- Modify: `packages/ai-elements/a11y/tsconfig.json` (drop the moved directory from `include`)
- Create: `.changeset/ai-elements-fixtures-subpath.md`

**Interfaces:**

- Consumes: nothing.
- Produces: `import { fixtures } from '@elirobinson/ai-elements/fixtures'` where `fixtures: Record<string, ComponentType>`, keyed by the component's `name` in the manifest. Tasks 3, 4 and 8 rely on this.

- [ ] **Step 1: Confirm the manifest cannot be polluted**

`packages/ai-elements/scripts/generate-manifest.mjs` walks only `dist/components`, `dist/ui` and `dist/lib`. A `dist/fixtures/` is invisible to it. Confirm before relying on it:

```bash
grep -n "for (const tier of" packages/ai-elements/scripts/generate-manifest.mjs
```

Expected: `for (const tier of ['components', 'ui', 'lib']) {`

- [ ] **Step 2: Move the directory**

```bash
git mv packages/ai-elements/a11y/fixtures packages/ai-elements/fixtures
```

`packages/ai-elements/fixtures/`, a sibling of `src/`. **Not inside `src/`** — `pnpm sync:elements` re-derives every file under `src/` from upstream bytes, so a new directory there reads as local divergence and jams the next bump.

- [ ] **Step 3: Create the fixtures tsconfig**

`packages/ai-elements/tsconfig.fixtures.json`. A second config because the package's own `tsconfig.json` sets `rootDir: "./src"`, and widening that would flatten every emitted path.

```jsonc
{
  /* The fixtures, compiled into dist/fixtures and published as
     `@elirobinson/ai-elements/fixtures`.

     A config of its own because the package's tsconfig.json pins
     `rootDir: "./src"` — the vendored tree is what that build is for, and
     widening the root would move every emitted file. Everything else is
     inherited, so the fixtures compile under exactly the settings the tree
     they mount compiles under: Bundler resolution and `lib: ES2023`.

     The manifest generator walks dist/components, dist/ui and dist/lib and
     nothing else, so this emit cannot appear in the roster. */
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "./fixtures",
    "outDir": "./dist/fixtures",
    "jsx": "react-jsx",
    "declaration": true,
  },
  "include": ["./fixtures/**/*"],
}
```

- [ ] **Step 4: Wire it into the build and the exports map**

In `packages/ai-elements/package.json`, change the `build` script:

```json
"build": "rm -rf dist && tsc -p ./tsconfig.json && tsc -p ./tsconfig.fixtures.json && node ./scripts/generate-manifest.mjs"
```

and add to `exports`, after `./lib/*`:

```json
"./fixtures": {
  "types": "./dist/fixtures/index.d.ts",
  "import": "./dist/fixtures/index.js"
},
```

`files` already carries `dist`, so nothing changes there.

- [ ] **Step 5: Repoint the a11y harness**

In `packages/ai-elements/a11y/harness/main.tsx`, change:

```tsx
import { fixtures } from '../fixtures/index.js';
```

to:

```tsx
import { fixtures } from '../../fixtures/index.js';
```

In `packages/ai-elements/a11y/tsconfig.json` the `include` is `["./**/*.ts", "./**/*.tsx"]` and `rootDir` is `".."`, so the moved directory is still in the program via the relative import. No change is needed there; confirm with the typecheck in the next step rather than editing speculatively.

- [ ] **Step 6: Run the audit, unchanged**

This is the regression gate for the whole task. The fixture contract has not changed, so the number must not change.

```bash
pnpm a11y:elements
```

Expected: **576 passed**, the same count as before the move. A different number means the move dropped or duplicated a fixture.

- [ ] **Step 7: Verify the manifest is unchanged and the subpath resolves**

```bash
pnpm nx run ai-elements:build
node -e "const m=require('./packages/ai-elements/dist/manifest.json');console.log(m.entries.length, m.entries.filter(e=>e.tier==='components').length)"
cd apps/docs && node --input-type=module --eval "console.log(import.meta.resolve('@elirobinson/ai-elements/fixtures'))"; cd ../..
```

Expected: the same entry counts as before (`48` components), and a resolved `file://` URL for the fixtures subpath.

- [ ] **Step 8: Confirm the vendored tree is untouched**

```bash
pnpm sync:elements --pinned
```

Expected: exit 0.

- [ ] **Step 9: Add the changeset**

`.changeset/ai-elements-fixtures-subpath.md`:

```markdown
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
```

- [ ] **Step 10: Commit**

```bash
git add -A packages/ai-elements .changeset/ai-elements-fixtures-subpath.md
git commit -m "$(cat <<'MSG'
feat(ai-elements): publish the reference fixtures as a subpath

One realistic mount per vendored component already existed, written for
A1's accessibility audit and reachable only from inside this repo. The
docs site needs the same mounts, and two copies of a 48-entry roster is
the drift this repo spends most of its tooling preventing.

A sibling of src/, never inside it: sync:elements re-derives everything
under src/ from upstream bytes, so a directory there reads as local
divergence. Its own tsconfig, because the package build pins rootDir to
src/. The manifest generator walks three named tiers, so dist/fixtures
cannot reach the roster.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Named variants

**Files:**

- Create: `packages/ai-elements/fixtures/variants.tsx`
- Modify: `packages/ai-elements/fixtures/index.tsx` (re-export `variants`)
- Create: `packages/ai-elements/fixtures/variants.test.ts`

**Interfaces:**

- Consumes: `fixtures` from Task 2.
- Produces: `variants: Record<string, Record<string, ComponentType>>` — component name → variant name → mount. Task 8 renders these. A component with no variants is simply absent from the map.

- [ ] **Step 1: Write the failing test**

`packages/ai-elements/fixtures/variants.test.ts`:

```ts
/* Variants are extra mounts for the demo pages: a tool mid-run, a stream
   half-arrived, an empty state. The audit does not use them — it measures the
   default mount — so nothing else would notice a variant naming a component
   that no longer exists. This does. */
import { describe, expect, it } from 'vitest';

import manifest from '../dist/manifest.json';
import { fixtures } from './index.js';
import { variants } from './variants.js';

const names = new Set(manifest.entries.map((entry) => entry.name));

describe('variants', () => {
  it('only name components the package actually ships', () => {
    for (const name of Object.keys(variants)) {
      expect(names.has(name), `variants has "${name}", which is not in the manifest`).toBe(true);
    }
  });

  it('only name components that already have a default mount', () => {
    /* A variant without a default is a demo page that renders a state of
       something the audit never measured. */
    for (const name of Object.keys(variants)) {
      expect(fixtures[name], `"${name}" has variants but no default fixture`).toBeDefined();
    }
  });

  it('give every variant a non-empty name', () => {
    for (const [name, group] of Object.entries(variants)) {
      expect(Object.keys(group).length, `"${name}" has an empty variant group`).toBeGreaterThan(0);
      for (const label of Object.keys(group)) {
        expect(label.trim().length, `"${name}" has a blank variant label`).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm vitest run packages/ai-elements/fixtures/variants.test.ts
```

Expected: FAIL — `Cannot find module './variants.js'`.

- [ ] **Step 3: Write the variants module**

`packages/ai-elements/fixtures/variants.tsx`. Start with the states the C1–C7 cards call for. Follow the composition rule the default fixtures already state in their header: render what a consumer would write, not the smallest thing that mounts, and open anything whose controls exist only in an open state.

```tsx
/* Extra mounts for the documentation, beyond the one realistic composition per
 * component that `./index.tsx` gives the accessibility audit.
 *
 * The audit wants exactly one mount per component: two of its four checks are
 * about a control's neighbours, so a gallery would measure the harness's layout
 * rather than the component. Documentation wants the opposite — a tool is worth
 * seeing pending, running, and errored, because those are the states a reader
 * is trying to decide between.
 *
 * Keyed by the component's name in the manifest, then by a label the demo page
 * renders verbatim. A component with nothing worth showing twice is absent.
 */
import type { ComponentType } from 'react';

import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@elirobinson/ai-elements/components/tool';

export const variants: Record<string, Record<string, ComponentType>> = {
  tool: {
    'Input streaming': () => (
      <Tool defaultOpen>
        <ToolHeader state="input-streaming" type="tool-searchDocs" />
        <ToolContent>
          <ToolInput input={{ query: 'touch target' }} />
        </ToolContent>
      </Tool>
    ),
    'Output available': () => (
      <Tool defaultOpen>
        <ToolHeader state="output-available" type="tool-searchDocs" />
        <ToolContent>
          <ToolInput input={{ query: 'touch target' }} />
          <ToolOutput errorText={undefined} output={<p>3 matches in contracts.json.</p>} />
        </ToolContent>
      </Tool>
    ),
    'Output error': () => (
      <Tool defaultOpen>
        <ToolHeader state="output-error" type="tool-searchDocs" />
        <ToolContent>
          <ToolInput input={{ query: 'touch target' }} />
          <ToolOutput errorText="The index is not built." output={undefined} />
        </ToolContent>
      </Tool>
    ),
  },
};
```

**Check the real prop names before writing this.** `ToolHeader`'s `state` union and `ToolOutput`'s props come from the pinned release, not from memory:

```bash
sed -n '1,120p' packages/ai-elements/src/components/tool.tsx
```

Adjust the mounts to whatever that file actually exports. The test in Step 1 does not catch a wrong prop; `pnpm typecheck` does.

- [ ] **Step 4: Re-export from the index**

At the foot of `packages/ai-elements/fixtures/index.tsx`:

```tsx
export { variants } from './variants.js';
```

- [ ] **Step 5: Run the test and the typecheck**

```bash
pnpm nx run ai-elements:build
pnpm vitest run packages/ai-elements/fixtures/variants.test.ts
```

Expected: PASS, and a clean build (which is what typechecks the mounts).

- [ ] **Step 6: Commit**

```bash
git add packages/ai-elements/fixtures
git commit -m "$(cat <<'MSG'
feat(ai-elements): add named variants beside the default fixtures

The audit wants one mount per component — two of its four checks measure
a control's neighbours, so a gallery would measure the harness. Docs want
the opposite: a tool pending, running and errored are the three states a
reader is choosing between.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: The fixture route

**Files:**

- Create: `apps/docs/src/app/fixtures/ai-elements/[component]/page.tsx`
- Create: `apps/docs/src/app/fixtures/ai-elements/fixtures.css`
- Modify: `apps/docs/package.json` (promote `ai` and `@ai-sdk/react` to dependencies, add `motion`)

**Interfaces:**

- Consumes: `fixtures` from Task 2, Tailwind from Task 1.
- Produces: 48 static routes at `/fixtures/ai-elements/<name>`, each rendering a bare `<main>` so the docs sweep's `main` clip selector matches. Task 9 shoots these.

- [ ] **Step 1: Understand why this route is outside `(docs)`**

`apps/docs/src/lib/site-map.ts` derives the sidebar from the `page` files under `src/app/(docs)`, and `apps/docs/src/lib/ai-elements.test.ts` asserts the AI Elements section's routes equal its directory listing. Forty-eight fixture pages inside `(docs)` would land in the sidebar, in the section guard, and in every chrome shot. Outside the group they are a test surface and nothing else. `DOCS_CONTENT_REGION` is `'main'` rather than `'.docs-main'` precisely so it still matches here — the home page already relies on that.

- [ ] **Step 2: Add the runtime dependencies**

The fixtures import `ai` and `lucide-react` and the route imports `MotionConfig`. `ai` and `@ai-sdk/react` are currently devDependencies of `apps/docs`, which was correct while the examples were only read as text. This route mounts them.

```bash
pnpm --filter docs add ai @ai-sdk/react motion
pnpm sync:deps
```

- [ ] **Step 3: Write the freeze stylesheet**

`apps/docs/src/app/fixtures/ai-elements/fixtures.css`:

```css
/* Animation is off on this route, unconditionally.

   These 48 pages exist to be photographed. Shimmer, the speech-input ping
   rings and every Radix transition are each enough to make a baseline
   disagree with itself between two runs of the same commit, and a suite that
   is reliably red carries no information — #101 is this repo's own record of
   what that costs.

   Scoped to the fixture stage rather than applied site-wide, because the docs
   site's own motion is covered by tokens.css's reduced-motion handling and is
   not this route's business. */
.fixture-stage,
.fixture-stage * {
  animation: none !important;
  transition: none !important;
}
```

- [ ] **Step 4: Write the route**

`apps/docs/src/app/fixtures/ai-elements/[component]/page.tsx`:

```tsx
import { MotionConfig } from 'motion/react';

import { fixtures } from '@elirobinson/ai-elements/fixtures';
import manifest from '@elirobinson/ai-elements/manifest';

import '../fixtures.css';

/* One vendored component per page, for the visual suite.
 *
 * Outside the (docs) route group on purpose. site-map.ts derives the sidebar
 * from the pages under (docs), so 48 fixture pages there would appear in the
 * nav, in the AI Elements section guard, and in every chrome shot — the exact
 * 142-shot fan-out that switched this project off in #101. Here they are a
 * test surface and nothing else.
 *
 * A bare <main>, because the docs sweep clips to `main` and `regionBox` throws
 * on a selector matching nothing rather than quietly framing the whole page.
 *
 * Motion is stopped twice, because CSS alone does not reach it. fixtures.css
 * kills CSS animation and transition; MotionConfig stops Shimmer, which
 * animates through Framer Motion's Web Animations path where `animation: none`
 * has no effect. `reducedMotion="always"` rather than "user" — the freeze must
 * not depend on a browser setting the container might not carry. */
export function generateStaticParams() {
  return manifest.entries.map((entry) => ({ component: entry.name }));
}

export const dynamicParams = false;

export default async function FixturePage({ params }: { params: Promise<{ component: string }> }) {
  const { component } = await params;
  const Fixture = fixtures[component];

  /* A component in the manifest with no fixture is a hole in the audit as well
     as in this page, so it is loud rather than blank. The a11y harness reports
     the same condition as a fixture error and its spec asserts on that first. */
  if (!Fixture) {
    return (
      <main className="fixture-stage">
        <p data-fixture-error={component}>No fixture named &quot;{component}&quot;.</p>
      </main>
    );
  }

  return (
    <main className="fixture-stage" data-fixture={component}>
      <MotionConfig reducedMotion="always">
        <Fixture />
      </MotionConfig>
    </main>
  );
}
```

- [ ] **Step 5: Build and confirm the routes are static**

```bash
rm -rf apps/docs/.next
pnpm nx run docs:build 2>&1 | tail -20
```

Expected: the build passes `apps/docs/scripts/assert-static-routes.mjs` — a `generateStaticParams` route counts as static via `prerender-manifest.json`'s `dynamicRoutes`. The route count rises from **87** to **135** (87 + 48). If any fixture throws at build time, the build fails and names it; report that rather than working around it.

- [ ] **Step 6: Expect `terminal` to fail here**

`TerminalContent` throws React #130 under Rolldown/Vite — an `ansi-to-react` CJS default-import interop failure. If the build fails on the `terminal` fixture, that is the known issue, it is **out of scope to fix**, and it is not worked around silently. Record the exact error, and if it blocks the build, exclude that one name from `generateStaticParams` with a comment naming the bug and pointing at the issue — never by deleting its fixture, which would also remove it from the audit.

- [ ] **Step 7: See it render**

```bash
pnpm nx run docs:build
```

Then open the built site through the Browser pane at `/fixtures/ai-elements/message` and `/fixtures/ai-elements/conversation`, in both themes, and confirm the components are skinned rather than unstyled. An unstyled render means Task 1's `@source` matched nothing.

- [ ] **Step 8: Commit**

```bash
git add apps/docs/src/app/fixtures apps/docs/package.json pnpm-lock.yaml
git commit -m "$(cat <<'MSG'
feat(docs): render every vendored component on a fixture route

48 static pages, one per manifest entry, fed the same mounts the
accessibility audit measures. Outside the (docs) group so they never
reach the sidebar, the section guard, or the chrome shots.

Motion is stopped twice. fixtures.css kills CSS animation; MotionConfig
stops Shimmer, which animates through Framer Motion's Web Animations
path where `animation: none` does nothing at all.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: The C1 patch

**Files:**

- Modify: `scripts/ai-elements-patches/a11y.mjs:79` (two entries appended to `PATCHES`)
- Create: `.changeset/ai-elements-conversation-instant-scroll.md`

**Interfaces:**

- Consumes: nothing.
- Produces: a vendored `conversation.tsx` whose `initial` and `resize` defaults are `"instant"`.

- [ ] **Step 1: Confirm the type accepts it**

Already verified against `use-stick-to-bottom@1.1.6`: `Animation = ScrollBehavior | SpringAnimation`, `initial?: Animation | boolean`, `resize?: Animation`, and `ScrollBehavior` is the DOM union including `"instant"`. Re-confirm, because the installed version can move:

```bash
grep -n "export type Animation\|resize?:\|initial?:" node_modules/.pnpm/use-stick-to-bottom@*/node_modules/use-stick-to-bottom/dist/useStickToBottom.d.ts
```

Expected: `export type Animation = ScrollBehavior | SpringAnimation;`

- [ ] **Step 2: Read the current anchor**

```bash
sed -n '25,36p' packages/ai-elements/src/components/conversation.tsx
```

Expected: a `<StickToBottom>` carrying `initial="smooth"`, `resize="smooth"` and `role="log"`, with `{...props}` **last**.

- [ ] **Step 3: Append the patch entries**

At the end of the `PATCHES` array in `scripts/ai-elements-patches/a11y.mjs`, before the closing `];`:

```js
  /* Motion inside a live region, which is this file's subject even though it
     is not a touch target. `Conversation` is a `role="log"`, and it scrolls
     itself smoothly on every new turn and every resize. Nothing in the
     vendored tree reads prefers-reduced-motion, so that animation is
     unconditional for every reader.

     Our own ChatThread — which C1 retires in favour of this component — used
     a plain `scrollTop` assignment for exactly this reason, recorded in its
     source: an instant jump has no motion to reduce, so it sidesteps the care
     an animation in a live region would otherwise need. That property is the
     one thing theirs lacked, and it is two words.

     `{...props}` is spread last upstream, so a consumer who wants the
     animation back writes `<Conversation initial="smooth">`. This changes the
     default, not the API. `initial` and `resize` both type as `Animation =
     ScrollBehavior | SpringAnimation`, and "instant" is a ScrollBehavior. */
  {
    id: 'conversation-initial-instant',
    upstreamPath: 'packages/elements/src/conversation.tsx',
    control: 'conversation.tsx — Conversation, first paint',
    verdict: 'primary',
    measured: 'animated smooth scroll on mount inside role="log"',
    why:
      'A live region that animates itself has no reduced-motion guard anywhere in ' +
      'the vendored tree. An instant jump has no motion to reduce, which is why our ' +
      'own retired ChatThread assigned scrollTop directly.',
    find: 'initial="smooth"',
    replace: 'initial="instant"',
  },
  {
    id: 'conversation-resize-instant',
    upstreamPath: 'packages/elements/src/conversation.tsx',
    control: 'conversation.tsx — Conversation, on resize',
    verdict: 'primary',
    measured: 'animated smooth scroll on every content resize inside role="log"',
    why:
      'Same region, same reason, and this is the one that fires on every streamed ' +
      'token rather than once on mount.',
    find: 'resize="smooth"',
    replace: 'resize="instant"',
  },
```

- [ ] **Step 4: Re-sync and confirm the patch applied**

```bash
pnpm sync:elements
grep -n 'initial=\|resize=' packages/ai-elements/src/components/conversation.tsx
```

Expected: `initial="instant"` and `resize="instant"`. If `sync:elements` throws naming one of these ids, the anchor string is wrong — read the file and fix the anchor. Do not delete the patch to make it pass.

- [ ] **Step 5: Confirm the tree is otherwise clean**

```bash
pnpm sync:elements --pinned
pnpm nx run ai-elements:build
pnpm a11y:elements
```

Expected: `sync:elements --pinned` exits 0, and the audit still reports **576 passed**.

- [ ] **Step 6: Add the changeset**

`.changeset/ai-elements-conversation-instant-scroll.md`:

```markdown
---
'@elirobinson/ai-elements': patch
---

`Conversation` now scrolls instantly rather than smoothly by default.

It is a `role="log"`, it scrolled itself with an animation on mount and on
every content resize, and nothing in the vendored tree reads
`prefers-reduced-motion`. An instant jump has no motion to reduce. Upstream
spreads `{...props}` last, so `<Conversation initial="smooth" resize="smooth">`
restores the previous behaviour — this changes the default, not the API.
```

- [ ] **Step 7: Commit**

```bash
git add scripts/ai-elements-patches/a11y.mjs packages/ai-elements/src/components/conversation.tsx .changeset/ai-elements-conversation-instant-scroll.md
git commit -m "$(cat <<'MSG'
fix(ai-elements): stop Conversation animating its own live region

Conversation is a role="log" that scrolled itself smoothly on mount and
on every resize, and nothing in the vendored tree reads
prefers-reduced-motion. Our retired ChatThread assigned scrollTop
directly for exactly this reason: an instant jump has no motion to
reduce.

Two words in the transform layer. {...props} is spread last upstream, so
this changes the default and not the API.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Deprecate our three-component AI tier

**Files:**

- Modify: `packages/react/src/components/ai/ChatThread.tsx:46`
- Modify: `packages/react/src/components/ai/ChatMessage.tsx:21`
- Modify: `apps/docs/src/app/(docs)/components/chat-thread/page.mdx`
- Modify: `apps/docs/src/app/(docs)/components/chat-message/page.mdx`
- Create: `.changeset/react-deprecate-chat-thread-message.md`

**Interfaces:**

- Consumes: nothing.
- Produces: `@deprecated` JSDoc on two exported components. No runtime change, no removal.

- [ ] **Step 1: Deprecate `ChatThread`**

Replace the JSDoc above `export const ChatThread`:

```tsx
/**
 * A scrolling conversation region that announces new turns to assistive technology.
 *
 * @deprecated Use `Conversation` from `@elirobinson/ai-elements/components/conversation`.
 *
 * `use-stick-to-bottom`, which backs it, already implements the one behaviour
 * this component was written for: follow the newest turn only for a reader who
 * is already at the bottom. Its smooth-scroll default was the gap, and the
 * transform layer now pins it to `instant` — see
 * `scripts/ai-elements-patches/a11y.mjs`, `conversation-initial-instant`.
 *
 * The one thing that does not carry over is the `announce` prop. `Conversation`
 * spreads `{...props}` last over its `role="log"`, so write the attributes
 * directly: `<Conversation aria-live="polite" aria-relevant="additions text">`,
 * or `aria-live="off"` for a closed or replayed thread.
 *
 * Published and in use, so this is a deprecation and not a removal. It goes on
 * the next major.
 */
```

- [ ] **Step 2: Deprecate `ChatMessage`**

Replace the JSDoc above `export const ChatMessage`:

```tsx
/**
 * A single turn in a conversation: avatar, optional attribution, content, and actions.
 *
 * @deprecated Use `Message` from `@elirobinson/ai-elements/components/message`.
 *
 * `Message` takes a `UIMessage` role directly, renders markdown through
 * Streamdown, and carries branch navigation and per-turn actions. This
 * component takes an avatar, a name and a timestamp. Both are turns; theirs is
 * the one the AI SDK feeds.
 *
 * Published and in use, so this is a deprecation and not a removal. It goes on
 * the next major.
 */
```

- [ ] **Step 3: Leave `StreamingCaret` alone**

`Shimmer` animates a gradient across a string of text. `StreamingCaret` marks the insertion point in text that is still arriving. Different jobs; it is not deprecated and it is not edited.

- [ ] **Step 4: Add the note to both docs pages**

At the top of `apps/docs/src/app/(docs)/components/chat-thread/page.mdx`, immediately after `<ComponentHeader slug="chat-thread" />`:

```mdx
> **Deprecated.** Use `Conversation` from `@elirobinson/ai-elements`. It is backed by
> `use-stick-to-bottom`, which already follows the newest turn only for a reader who is
> already at the bottom, and this system pins its scroll to instant rather than smooth.
> The `announce` prop has no direct equivalent — write the attributes instead:
> `aria-live="polite"` and `aria-relevant="additions text"`, or `aria-live="off"` for a
> replayed thread. This component still works and is removed on the next major.
```

And in `apps/docs/src/app/(docs)/components/chat-message/page.mdx`, after its `<ComponentHeader slug="chat-message" />`:

```mdx
> **Deprecated.** Use `Message` from `@elirobinson/ai-elements`. It takes a `UIMessage`
> role directly, renders markdown through Streamdown, and carries branch navigation. This
> component still works and is removed on the next major.
```

- [ ] **Step 5: Run the tests**

```bash
pnpm nx run-many -t test --projects=react,docs
pnpm lint
```

Expected: pass. The existing `ChatThread.test.tsx` and `ChatMessage.test.tsx` are unchanged — behaviour has not moved.

- [ ] **Step 6: Add the changeset**

`.changeset/react-deprecate-chat-thread-message.md`:

```markdown
---
'@elirobinson/react': minor
---

Deprecate `ChatThread` and `ChatMessage` in favour of `@elirobinson/ai-elements`.

`Conversation` is backed by `use-stick-to-bottom`, which already implements the
follow-only-a-reader-at-the-bottom behaviour `ChatThread` was written for; its
smooth-scroll default was the real gap and the transform layer now pins it to
instant. `Message` takes a `UIMessage` role, renders markdown, and carries
branch navigation.

`ChatThread`'s `announce` prop has no direct equivalent. `Conversation` spreads
props last over its `role="log"`, so write `aria-live` and `aria-relevant`
directly.

`StreamingCaret` is **not** deprecated. `Shimmer` animates a gradient across a
string; a caret marks the insertion point in text that is still arriving.

Both components still work. They are removed on the next major.
```

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/components/ai apps/docs/src/app/\(docs\)/components/chat-thread apps/docs/src/app/\(docs\)/components/chat-message .changeset/react-deprecate-chat-thread-message.md
git commit -m "$(cat <<'MSG'
feat(react)!: deprecate ChatThread and ChatMessage

C1's decision. use-stick-to-bottom already implements the one behaviour
ChatThread was written for; its smooth-scroll default was the gap, and
the previous commit closed it. Message takes a UIMessage role and renders
markdown, which ours never did.

Deprecated, not deleted — both are published at v3.2.1 and consumers
exist. Removal is on the next major.

StreamingCaret survives. Shimmer animates a gradient across a string; a
caret marks where text is still arriving. Different jobs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

- [ ] **Step 8: Close card #122 deliberately**

Card #122 is a dark-theme `ChatThread` visual flake. It retires with the component. Close it with a comment linking this commit and the spec, or say plainly in the final report that it is still open and why.

---

### Task 7: The family map and the guard

**Files:**

- Create: `apps/docs/src/lib/ai-element-families.ts`
- Modify: `apps/docs/src/lib/ai-elements.test.ts` (extend the roster guard)

**Interfaces:**

- Consumes: `elements` from `apps/docs/src/lib/ai-elements.ts`.
- Produces: `FAMILIES: readonly Family[]` where `Family = { slug: string; title: string; card: string; components: readonly string[] }`. Task 8's pages are one per entry.

- [ ] **Step 1: Write the family map**

`apps/docs/src/lib/ai-element-families.ts`:

```ts
/* The vendored components that are worth documenting together, and the card
 * each grouping comes from.
 *
 * A written-down list of component names, which the root rule normally forbids
 * — so it takes the same shape as the `NAMEABLE` table in ai-elements.test.ts,
 * for the same reason. Each entry carries the card that decided it, the test
 * beside it fails when a name stops existing, and a demo page may name only the
 * subpaths of its own family. What the rule actually forbids is a roster typed
 * into prose that quietly goes wrong on the next re-sync; this is neither prose
 * nor a roster.
 *
 * It is explicitly a subset. Seven pages cover 22 of the 48 vendored
 * components, and /components/ai-elements — generated from the manifest — stays
 * the only complete list. A component that is in no family is documented there
 * and nowhere else, which is the intended outcome, not a gap.
 */

export type Family = {
  /** The route segment under /components/ai-elements. */
  slug: string;
  /** The page title, and the sidebar entry. */
  title: string;
  /** The Trello card this grouping is from, so the reasoning is findable. */
  card: string;
  /** Manifest names, not subpaths. Asserted against the manifest. */
  components: readonly string[];
};

export const FAMILIES: readonly Family[] = [
  {
    slug: 'conversation',
    title: 'Conversation and messages',
    card: 'C1',
    components: ['conversation', 'message'],
  },
  {
    slug: 'prompt-input',
    title: 'Prompt input',
    card: 'C2',
    components: ['prompt-input', 'attachments', 'model-selector'],
  },
  {
    slug: 'reasoning',
    title: 'Reasoning',
    card: 'C3',
    components: ['reasoning', 'chain-of-thought', 'shimmer'],
  },
  {
    slug: 'tools',
    title: 'Tools and tasks',
    card: 'C4',
    components: ['tool', 'confirmation', 'task'],
  },
  {
    slug: 'sources',
    title: 'Sources and context',
    card: 'C5',
    components: ['sources', 'inline-citation', 'context'],
  },
  {
    slug: 'planning',
    title: 'Suggestions and plans',
    card: 'C6',
    components: ['suggestion', 'plan', 'queue', 'checkpoint'],
  },
  {
    slug: 'artifacts',
    title: 'Code and artifacts',
    card: 'C7',
    components: ['code-block', 'artifact', 'image', 'snippet'],
  },
] as const;

/** The subpaths a family's page is permitted to name. */
export function familySubpaths(family: Family, packageName: string): string[] {
  return family.components.map((name) => `${packageName}/components/${name}`);
}
```

**Verify every name exists before moving on.** These are read from the C1–C7 cards, and a card's prose name is not always the manifest name:

```bash
node -e "
const m=require('./packages/ai-elements/dist/manifest.json');
const names=new Set(m.entries.map(e=>e.name));
const want=['conversation','message','prompt-input','attachments','model-selector','reasoning','chain-of-thought','shimmer','tool','confirmation','task','sources','inline-citation','context','suggestion','plan','queue','checkpoint','code-block','artifact','image','snippet'];
const missing=want.filter(n=>!names.has(n));
console.log(missing.length ? 'MISSING: '+missing.join(', ') : 'all 22 present');
"
```

Expected: `all 22 present`. Fix any mismatch in the map, not in the manifest.

- [ ] **Step 2: Write the failing test**

Append to `apps/docs/src/lib/ai-elements.test.ts`:

```ts
describe('the demo families', () => {
  it('name only components the package ships', () => {
    const names = new Set(elements.map((entry) => entry.name));
    for (const family of FAMILIES) {
      for (const name of family.components) {
        expect(
          names.has(name),
          `family '${family.slug}' names '${name}', which is not shipped`,
        ).toBe(true);
      }
    }
  });

  it('do not claim the same component twice', () => {
    /* Two pages documenting one component is two places for it to go stale,
       and the roster guard below would then permit its subpath on both. */
    const seen = new Map<string, string>();
    for (const family of FAMILIES) {
      for (const name of family.components) {
        expect(
          seen.has(name),
          `'${name}' is in both '${seen.get(name)}' and '${family.slug}'`,
        ).toBe(false);
        seen.set(name, family.slug);
      }
    }
  });

  it('each have a page on disk', () => {
    for (const family of FAMILIES) {
      expect(
        existsSync(join(SECTION_DIR, family.slug, 'page.mdx')),
        `family '${family.slug}' has no page`,
      ).toBe(true);
    }
  });
});
```

Add the import at the top of the file:

```ts
import { FAMILIES, familySubpaths } from './ai-element-families';
```

- [ ] **Step 3: Extend the roster guard rather than weakening it**

In the existing `describe('no page writes down the roster')`, replace the body of the first `it` so a family page may name its own components and nothing else:

```ts
const allowed = new Set(NAMEABLE.map((entry) => entry.subpath));
/* A demo page documents specific components, so it must name their
       subpaths — that is the code a reader copies. The permission is derived
       from the family map rather than granted page-by-page, so a page that
       grows a mention of a component it does not document is still red, and a
       component upstream removes fails the family test above first. */
const byRoute = new Map<string, Set<string>>();
for (const family of FAMILIES) {
  byRoute.set(`${SECTION_ROUTE}/${family.slug}`, new Set(familySubpaths(family, ELEMENTS_PACKAGE)));
}

for (const [route, source] of sectionPages()) {
  const ownFamily = byRoute.get(route) ?? new Set<string>();
  for (const entry of elements) {
    if (allowed.has(entry.subpath) || ownFamily.has(entry.subpath)) {
      continue;
    }
    expect(
      source.includes(entry.subpath),
      `${route} names ${entry.subpath} — the index is generated, so this list will rot`,
    ).toBe(false);
  }
}
```

Add `ELEMENTS_PACKAGE` to the existing import from `./ai-elements`.

- [ ] **Step 4: Run it and watch it fail**

```bash
pnpm vitest run apps/docs/src/lib/ai-elements.test.ts
```

Expected: FAIL on `each have a page on disk` — seven families, no pages yet. That is Task 8.

- [ ] **Step 5: Commit the map and the guard**

The failing test is committed deliberately: it is the specification for Task 8, and Task 8's first step is watching it go green.

```bash
git add apps/docs/src/lib/ai-element-families.ts apps/docs/src/lib/ai-elements.test.ts
git commit -m "$(cat <<'MSG'
test(docs): derive the demo families, and let a page name its own

A demo page has to name the subpaths it documents — that is the code a
reader copies — and the roster guard forbade every vendored subpath
outright. The permission is now derived from the family map rather than
granted page by page, so a page mentioning a component it does not
document is still red.

The pages themselves are the next commit; this test is what specifies
them, so it lands failing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: The seven demo pages

**Files:**

- Create: `apps/docs/src/components/docs/ElementsPatchTable.tsx`
- Create: `apps/docs/src/components/docs/ElementsDemo.tsx`
- Create: `apps/docs/src/app/(docs)/components/ai-elements/<slug>/page.mdx` ×7

**Interfaces:**

- Consumes: `FAMILIES` (Task 7), `fixtures` and `variants` (Tasks 2–3), Tailwind (Task 1).
- Produces: seven routes under `/components/ai-elements/`, each in the sidebar via `site-map.ts`'s derivation.

- [ ] **Step 1: Write the patch table component**

`apps/docs/src/components/docs/ElementsPatchTable.tsx`. This is the part upstream's own docs get wrong for our copy, and it must be generated.

```tsx
import contracts from '@elirobinson/ai-patterns/contracts';

/* What this system changed about a vendored component, and why — read from
   contracts.json's `vendoredElementTargets` rather than retyped.

   Upstream's documentation at elements.ai-sdk.dev describes the unskinned,
   unpatched component. Ours is that component plus a known transform, and the
   transform is the interesting part: each entry names one control, the geometry
   a browser measured for it, which of the two touch-target floors it was held
   to, and why it is that one and not the other.

   Keyed by the patch id, which is also the id in
   scripts/ai-elements-patches/a11y.mjs — so a patch that is renamed or removed
   drops out of the page by itself. `policy` is the preamble, not a control. */
export function ElementsPatchTable({ components }: { components: readonly string[] }) {
  const targets = contracts.vendoredElementTargets as Record<string, string>;
  const rows = Object.entries(targets).filter(
    ([id, text]) => id !== 'policy' && components.some((name) => text.includes(`${name}.tsx`)),
  );

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Patch</th>
            <th>What changed, and why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([id, text]) => (
            <tr key={id}>
              <td>
                <code>{id}</code>
              </td>
              <td>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Confirm the shape first.** `vendoredElementTargets` is an object of 31 keys — 30 patch entries plus `policy`. Check whether each value is a string or an object before writing the render:

```bash
node -e "
const c=JSON.parse(require('fs').readFileSync('./packages/ai-patterns/src/contracts.json','utf8'));
const v=c.vendoredElementTargets;
const k=Object.keys(v).filter(x=>x!=='policy')[0];
console.log(k, '->', typeof v[k]); console.log(JSON.stringify(v[k],null,2).slice(0,400));
"
```

Adjust the component to whatever that prints. The exported subpath is `@elirobinson/ai-patterns/contracts` (it maps to `./src/contracts.json`) — **not** `/contracts.json`, which does not resolve. If importing JSON trips `resolveJsonModule`, read the file with `readFileSync` at build time the way `apps/docs/src/lib/examples.ts` reads across the workspace.

- [ ] **Step 2: Write the demo wrapper**

`apps/docs/src/components/docs/ElementsDemo.tsx`:

```tsx
import { MotionConfig } from 'motion/react';

import { fixtures, variants } from '@elirobinson/ai-elements/fixtures';

/* A vendored component, mounted from the same fixture the accessibility audit
   measures. Not a hand-written demo: two mounts of one component is two things
   to keep in step, and the audit's is the one that was actually verified.

   Fed a canned composition, never a live model. A live model is not
   deterministic and the visual suite cannot photograph it. */
export function ElementsDemo({ component, variant }: { component: string; variant?: string }) {
  const Fixture = variant ? variants[component]?.[variant] : fixtures[component];

  if (!Fixture) {
    throw new Error(
      `ElementsDemo: no ${variant ? `variant "${variant}" of ` : ''}fixture "${component}". ` +
        'Fixtures live in packages/ai-elements/fixtures.',
    );
  }

  return (
    <figure className="demo-block">
      <div className="demo-block__stage fixture-stage">
        <MotionConfig reducedMotion="always">
          <Fixture />
        </MotionConfig>
      </div>
    </figure>
  );
}
```

A `throw` rather than a fallback: the page is built at build time, so a missing fixture fails the build instead of shipping a blank box.

- [ ] **Step 3: Register both in the MDX component map**

Add `ElementsDemo` and `ElementsPatchTable` to `apps/docs/mdx-components.tsx` if that file maps components; otherwise import them per page the way `button/page.mdx` imports its demos. Check which:

```bash
grep -n "ElementsDemo\|DemoBlock\|components =" apps/docs/mdx-components.tsx | head
```

- [ ] **Step 3b: Claim the sidebar orders**

`site-map.ts` requires an explicit `order` in every page's metadata — a page's
position in the sidebar is stated, never directory listing order. The four
existing pages hold 1–4 (`overview` 1, the index 2, `installation` 3, `examples`
4), so the seven families take **5–11** in card order:

| Slug           | Order |
| -------------- | ----- |
| `conversation` | 5     |
| `prompt-input` | 6     |
| `reasoning`    | 7     |
| `tools`        | 8     |
| `sources`      | 9     |
| `planning`     | 10    |
| `artifacts`    | 11    |

Confirm the four existing values before writing, rather than trusting this table:

```bash
grep -rn "order:" 'apps/docs/src/app/(docs)/components/ai-elements' | grep page.mdx
```

- [ ] **Step 4: Write the C1 page**

`apps/docs/src/app/(docs)/components/ai-elements/conversation/page.mdx`. Model it on `button/page.mdx` — live demo, import subpath, keyboard and accessibility contract, related links.

````mdx
import { ElementsDemo } from '@/components/docs/ElementsDemo';
import { ElementsPatchTable } from '@/components/docs/ElementsPatchTable';

export const metadata = { title: 'Conversation and messages', order: 5 };

# Conversation and messages

The scrolling log and the turns inside it. `Conversation` follows the newest turn only
for a reader who is already at the bottom; scroll up to re-read something and it stays
put until you come back.

<ElementsDemo component="conversation" />

## Import

```tsx
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@elirobinson/ai-elements/components/conversation';
import { Message, MessageContent } from '@elirobinson/ai-elements/components/message';
```
````

There is no barrel. A bare `@elirobinson/ai-elements` import does not resolve.

## Messages

<ElementsDemo component="message" />

## Accessibility

- `Conversation` renders `role="log"`. It does **not** set `aria-live`, and props are
  spread last, so state it yourself: `aria-live="polite"` with
  `aria-relevant="additions text"` for a live thread, `aria-live="off"` for one that is
  closed or being replayed.
- Scrolling is instant in this system, not animated. Upstream's default is a smooth
  scroll, which is motion inside a live region with no reduced-motion guard behind it —
  see the table below.
- **Keyboard:** the scroll region is focusable and scrolls with the arrow keys, `Page
Up`/`Page Down`, `Home` and `End`. `ConversationScrollButton` is a real button and is
  reachable with `Tab`.

## What this system changed

<ElementsPatchTable components={['conversation', 'message']} />

## Replacing ChatThread

`ChatThread` and `ChatMessage` from `@elirobinson/react` are deprecated in favour of
these. `use-stick-to-bottom` already implements the follow-the-bottom behaviour
`ChatThread` was written for. The one thing that does not carry across is the `announce`
prop — write `aria-live` directly, as above.

````

- [ ] **Step 5: Confirm that page builds and the guard goes green for it**

```bash
pnpm nx run docs:build
pnpm vitest run apps/docs/src/lib/ai-elements.test.ts
````

Expected: the build passes and the family test now fails only on the six pages that do not exist yet.

- [ ] **Step 6: Write the remaining six pages**

One per family, same structure: title and its `order` from the table in Step 3b, a one-paragraph "what this is for", an `<ElementsDemo>` per component, the import block, the accessibility contract, and `<ElementsPatchTable>`. Read each card before writing its page — each carries traps a generic demo page misses:

- C2 `prompt-input` — https://trello.com/c/YLJfEbDc
- C3 `reasoning` — https://trello.com/c/4GZu234U
- C4 `tools` — https://trello.com/c/nMc8bYG0
- C5 `sources` — https://trello.com/c/gLQBQpnO
- C6 `planning` — https://trello.com/c/AuFpczEd
- C7 `artifacts` — https://trello.com/c/o0hZTgff

Two page-level notes to carry:

- On C3, `shimmer` animates. Say that it is frozen in these demos and that nothing in the vendored tree reads `prefers-reduced-motion`.
- On C4, use the three `tool` variants from Task 3 so the pending, complete and errored states are all visible: `<ElementsDemo component="tool" variant="Output error" />`.

- [ ] **Step 7: Run the whole guard**

```bash
pnpm vitest run apps/docs/src/lib/ai-elements.test.ts
```

Expected: all green — every family has a page, no page names a subpath outside its own family, every specifier resolves in a real Node subprocess, and the section's routes still equal the site map's.

- [ ] **Step 8: Confirm the placement rules still hold**

Two assertions the section guard already carries, which this task must not break:

```bash
grep -n 'Tailwind 4' 'apps/docs/src/app/(docs)/components/page.tsx'
grep -n 'components/ai-elements/installation' 'apps/docs/src/app/(docs)/components/page.tsx'
```

Expected: both match. The `/components` page's counted claim (`All {n} components, grouped by atomic tier`, from the `@elirobinson/react` manifest) must also still be true — seven new pages in the AI Elements group must not change that number.

- [ ] **Step 9: Commit**

```bash
git add apps/docs/src/components/docs/ElementsDemo.tsx apps/docs/src/components/docs/ElementsPatchTable.tsx 'apps/docs/src/app/(docs)/components/ai-elements'
git commit -m "$(cat <<'MSG'
docs(site): seven demo pages for the vendored AI tier

One per card, C1-C7, covering the 22 components those cards group. The
other 26 stay in the generated index; a page per component would be 48
pages restating it.

Every demo mounts the same fixture the accessibility audit measures, so
a demo cannot show a composition nobody verified. The patch table is read
from contracts.json rather than retyped — upstream's own docs describe
the unpatched component, which is what makes this section worth having.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Baselines and full verification

**Files:**

- Modify: `tests/visual/__screenshots__/**` (new baselines, minted by CI)

**Interfaces:**

- Consumes: everything above.
- Produces: a PR ready for review.

- [ ] **Step 1: Run every local gate**

```bash
pnpm sync:elements --pinned
pnpm nx run-many -t build,test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm a11y:elements
```

Expected: `sync:elements` exits 0; **10 projects** build and test; lint, typecheck and format clean; a11y **576 passed**. Report the real numbers. If any differ from these, say so and explain — do not round a failure up to a pass.

- [ ] **Step 2: Confirm the route count**

```bash
rm -rf apps/docs/.next
pnpm nx run docs:build 2>&1 | tail -5
```

Expected: **142 static routes** — 87 before, plus 48 fixture routes, plus 7 family pages. If the number differs, account for it before pushing.

- [ ] **Step 3: Verify one shot's logic locally**

The visual suite needs a pinned container, but a single shot's guards run without Docker: a guard throws before `toHaveScreenshot`, a pixel mismatch after. Run one fixture shot by title to prove the route is reachable and the clip selector matches.

```bash
pnpm nx run-many -t build --projects=storybook,docs
pnpm test:visual --project=docs-wide --grep "fixtures/ai-elements/message"
```

A failure that names `regionBox` means `main` matched nothing on the fixture route. A pixel mismatch means the route rendered and only the image differs — that is expected for a brand-new shot.

- [ ] **Step 4: Push and read CI honestly**

```bash
git push
gh pr checks 228
```

Expect scoped red. CI mints baselines for genuinely new shots. Changed shots will include the sidebar and header chrome, because seven pages joined the AI Elements group — that is a real pixel change and it belongs in exactly one baseline each.

- [ ] **Step 5: Accept baselines carefully**

Apply the `visual-accept` label. It accepts **once**, on the run it is applied to; a later push is not covered and the label must be removed and re-added.

**Then read the accept commit's file list before merging.** The label regenerates whatever failed in that run, so it can swallow an unrelated flake. `/brand/guidelines` flakes in both themes and is known and unrelated — if it appears in the accept commit, that is a flake being swallowed. `main`'s `full` job re-runs failing shots against the same baseline, so a ✓ there proves a flake. Never accept a flake.

- [ ] **Step 6: Report**

State plainly:

- Every command run and its real result.
- That `TerminalContent` (React #130) and `transcription`'s AA contrast failure are known, untouched, and why.
- Whether card #122 was closed.
- That C1–C7's adoption work beyond C1 is **not** done here: these are demo pages plus C1's decision, and C2–C7's own adopt-and-skin decisions remain with their cards.
