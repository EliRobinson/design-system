# Product Voice Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the brand prose the same dial colour already has — a named, replaceable voice pack — so the design system stops shipping one consumer's business facts as its own rules, and a test rather than an eye keeps it that way.

**Architecture:** The system ships a voice _schema_, a _renderer_, and a _resolver_; `design-system-docs/miltinson.voice.json` is one pack that happens to be the default. Every surface that today carries a hand-kept copy of the voice — the README's `## CONTENT FUNDAMENTALS`, `guidelines/brand-voice.html`, `contracts.json`'s tone string — is generated from that pack instead. A consumer drops a `voice.json` at its repo root and the resolver prefers it. Nothing is deleted at any point, so there is never a release where the tarball is worse.

**Tech Stack:** Node ESM (`.mjs`), Vitest (`environment: 'node'`, `include: ['src/**/*.test.mjs']`), pnpm workspaces, Nx, Changesets, Prettier via lint-staged.

**Spec:** [`docs/superpowers/specs/2026-08-26-brand-boundary-design.md`](../specs/2026-08-26-brand-boundary-design.md)

## Global Constraints

- **Cardinal rule (`CLAUDE.md`):** Nothing published may require a consumer to update prose when this repo changes. A word list a consumer would have to copy is a bug in what we publish.
- **Boundary rule (this plan's reason for existing):** The system ships what is inert until chosen, or true under every brand. The consumer holds anything an agent applies by default with no dial to turn.
- **Changesets:** ANY file under `packages/` needs a changeset, tests included. `changeset status` reads through git — `git add` the changeset file or it is invisible. Every PR in this plan touches `packages/`, so every PR gets one.
- **No barrel files.** Import through package subpaths.
- **Test file location:** `packages/ai-patterns/vitest.config.ts` sets `include: ['src/**/*.test.mjs']`. A test outside `packages/ai-patterns/src/**` will not run, and a test file not ending `.test.mjs` will not run.
- **Build `react` before running the `ai-patterns` suite.** `src/artifacts/pack-integrity.test.mjs` shells out to `build-artifacts.mjs`, which resolves `@elirobinson/react/manifest`. Without it that one file fails with `Cannot resolve @elirobinson/react/manifest` and nothing else does — a confusing failure that is not your change. Run `pnpm nx build react` once per worktree.
- **Verified green baseline before any of this work:** `pnpm nx build react` then `pnpm --filter @elirobinson/ai-patterns exec vitest run` → **40 files, 703 tests, all passing**. If your run shows a different total, reconcile that before trusting a red.
- **Filtering tests:** pass the pattern straight to vitest — `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/render`. Do **not** write `pnpm --filter … test -- voice/render`: the `--` reaches vitest as a bare argument, the filter is silently ignored, and all 40 files run.
- **`design-system-docs/**` is eslint-ignored** (`eslint.config.mjs:21`). Guards over that tree must be tests, not lint rules.
- **`apps/docs/public/brand/` is gitignored** and staged from `design-system-docs/` by `apps/docs/scripts/stage-brand.mjs` at build time. Editing the source tree is sufficient; never edit the staged copy.
- **Nx locally:** use `pnpm nx <target> <project>` — verified working in a worktree. `npx nx` and `node_modules/.bin/nx` fail with a bogus `Failed to parse "nx.json"` (a wrapper plain-`JSON.parse`s a JSONC file). `.nx/installation/node_modules/.bin/nx` is a workaround for the **main checkout only** — that directory is generated and is not present in a fresh worktree, where only `.nx/nxw.js` exists.
- **Rebase before pushing.** `main` moves fast. A PR with merge conflicts runs zero workflows silently — check `gh pr view N --json mergeable,mergeStateStatus` if a PR shows no runs.
- **Squash-merge repo.** A merged branch is never an ancestor of `main`; check PR state, not `git merge-base --is-ancestor`.
- **Kept deliberately, do not "fix":** the system's name (`Miltinson Design System`), `[data-palette='miltinson']`, Miltinson Amber as the default palette, Geist and JetBrains Mono in `@elirobinson/tokens`.

---

## File Structure

**New, in `packages/ai-patterns/src/voice/`** — the system's half. Split by responsibility; each file is independently testable and none imports the others' internals.

| file                 | responsibility                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `schema.mjs`         | The section list, each marked `system` or `product`, and `validatePack()`. Knows nothing about markdown. |
| `render.mjs`         | Pack → the three rendered forms. Knows nothing about the filesystem.                                     |
| `resolve.mjs`        | Consumer pack → built-in default. Knows nothing about rendering.                                         |
| `starter.voice.json` | The schema restated with system defaults and nothing else. Never contains a brand's values.              |

**New, in `design-system-docs/`** — the brand's half.

| file                         | responsibility                                            |
| ---------------------------- | --------------------------------------------------------- |
| `miltinson.voice.json`       | One pack. The only hand-kept copy of the voice, anywhere. |
| `ui_kits/_shared/content.js` | The kits' Miltinson strings, in one place (PR 4).         |

**Modified.** `brand.mjs` (named managed blocks), `llms.mjs` (`brandVoice` comment-stripping, then the `## Voice` relabel), `contracts.json` + its generator, `commands.mjs`/`init.mjs` (`ds voice`, `ds init --voice`), `server.mjs` (`get_brand_guidance`), `build-artifacts.mjs`, `build-design-project.mjs`, `guideline-cards.mjs` (docblock), `product-token-layer.md`, `AGENTS.md`.

**New docs.** `docs/agents/brand-boundary.md`.

---

# PR 1 — the rule, and the two fixes that are correct regardless

Branch: `claude/brand-boundary-rule`. Leads because every later PR cites the rule it writes down, and because a real postal address on a public site should not wait on a design.

### Task 1: Write the boundary rule down

**Files:**

- Create: `docs/agents/brand-boundary.md`
- Modify: `AGENTS.md` (topic guides list)

**Interfaces:**

- Produces: `docs/agents/brand-boundary.md` containing a `## Permitted files` section with a markdown table whose first column is a repo-relative path. Task 16's test parses that table. The heading text and column position are load-bearing — do not rename them.

- [ ] **Step 1: Create the guide**

Create `docs/agents/brand-boundary.md`. It must contain, in this order: the rule; the nine-row verdict table from the spec's "The boundary rule" section; the "named as unsettled" items; and a `## Permitted files` section. Copy the rule verbatim:

```markdown
# Brand boundary

**The system ships what is inert until chosen, or true under every brand. The consumer
holds anything an agent applies by default with no dial to turn.**

Where a constraint is arguable: it stays in the system only if it can be justified without
naming a brand's character — and then it must be _written_ that way.
```

The `## Permitted files` section must open with exactly this table, and nothing else may be added to it without a matching change to `brand-boundary.test.mjs`:

```markdown
## Permitted files

Every other published file is checked against the brand denylist. These are not, because
holding a brand's values is what they are for.

| path                                            | why                                 |
| ----------------------------------------------- | ----------------------------------- |
| `design-system-docs/miltinson.voice.json`       | one voice pack; the shipped default |
| `design-system-docs/ui_kits/_shared/content.js` | the kits' strings, in one place     |
| `design-system-docs/README.md`                  | the brand skill's own document      |
| `design-system-docs/SKILL.md`                   | the brand skill's own frontmatter   |
```

Also record the two unsettled items explicitly, so they are named rather than dropped:

```markdown
## Named as unsettled

- **Is the avoid list system-level?** `synergy, leverage, unlock, empower` reads as a
  blocklist any product would accept. Promoting it would breach `patterns.md:84`, which
  forbids the chrome rule from reaching editorial voice. Every schema section is marked
  `product` until this is decided on purpose. (#159 open question 1.)
- **Does the tone ranking apply to a consumer's product?** Left open on the same terms.
  (#159 open question 2.)
```

- [ ] **Step 2: Link it from `AGENTS.md`**

`AGENTS.md` has a `## Topic guides` list. Add one line, keeping the existing style:

```markdown
- [Brand boundary](docs/agents/brand-boundary.md) — what is the system's and what is a consumer's, and the test that enforces it
```

Edit `AGENTS.md` only. `CLAUDE.md` is a symlink to it.

- [ ] **Step 3: Verify the symlink was not clobbered**

Run: `ls -l CLAUDE.md`
Expected: output shows `CLAUDE.md -> AGENTS.md`. If it is now a regular file, restore it with `ln -sf AGENTS.md CLAUDE.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/brand-boundary.md AGENTS.md
git commit -m "docs(agents): the brand boundary rule, and the files permitted to cross it"
```

---

### Task 2: Remove the real postal address from the public brand site

**Files:**

- Modify: `design-system-docs/patterns/invoice/invoice.html:39`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing other tasks read.

- [ ] **Step 1: Read the current markup**

Run: `sed -n '36,45p' design-system-docs/patterns/invoice/invoice.html`
Expected: a `From` block containing `Miltinson Technologies<br>Eli Robinson<br>Leeds, United Kingdom<br>eli@miltinsons.com`, and a `Billed to` block that is already fictional (`Harrogate Junior FC`, `sam@example.com`).

- [ ] **Step 2: Replace the From block with a matching fiction**

The pattern demonstrates a table layout; the sender is set dressing. Match the register of the fictional `Billed to` block beside it.

Replace:

```html
<p style="margin:0;font-size:13px;line-height:1.6">
  Miltinson Technologies<br />Eli Robinson<br />Leeds, United Kingdom<br />eli@miltinsons.com
</p>
```

With:

```html
<p style="margin:0;font-size:13px;line-height:1.6">
  Northgate Studio<br />A. Whitfield<br />Leeds, United Kingdom<br />hello@example.com
</p>
```

- [ ] **Step 3: Verify no real contact details remain anywhere under `patterns/`**

Run: `grep -rn "eli@miltinsons\|Leeds, United Kingdom" design-system-docs/patterns/`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add design-system-docs/patterns/invoice/invoice.html
git commit -m "fix(brand): the invoice pattern no longer renders a real postal address"
```

---

### Task 3: Fail the build on a colour literal in the shipped UI kits

TDD. The test comes first and must fail against the literal that is there today.

**Files:**

- Create: `packages/ai-patterns/src/artifacts/ui-kit-literals.test.mjs`
- Modify: `design-system-docs/ui_kits/_shared/Primitives.jsx:19`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing other tasks import. Task 14 must keep this test passing.

- [ ] **Step 1: Write the failing test**

Create `packages/ai-patterns/src/artifacts/ui-kit-literals.test.mjs`:

```javascript
/* The shipped UI kits, checked for colour literals.
 *
 * eslint.config.mjs ignores design-system-docs/** wholesale, which is exactly why
 * Primitives.jsx painted the wordmark's period `oklch(72.5% 0.175 65)` — --signal-500
 * under ember, written as a constant — and the wordmark stayed amber under every other
 * palette. The kits are static JSX with no build step, so un-ignoring them would cascade;
 * the guard is a test instead.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const kitsDir = join(here, '..', '..', '..', '..', 'design-system-docs', 'ui_kits');

/** Every .jsx and .html file under ui_kits, as {file, source}. */
function kitFiles(dir = kitsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return kitFiles(path);
    if (!/\.(jsx|html)$/.test(entry.name)) return [];
    return [{ file: relative(kitsDir, path), source: readFileSync(path, 'utf8') }];
  });
}

/* Matches oklch(), rgb()/rgba(), hsl()/hsla() and #rgb/#rrggbb. Deliberately not
   matching `currentColor`, `transparent`, `inherit` or `none`, which carry no brand. */
const COLOUR_LITERAL = /(oklch\(|rgba?\(|hsla?\(|#[0-9a-fA-F]{3,8}\b)/g;

describe('the shipped UI kits paint no colour literals', () => {
  const files = kitFiles();

  it('finds kit files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('$file', ({ source }) => {
    expect(source.match(COLOUR_LITERAL) ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails on the real defect**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run ui-kit-literals`
Expected: FAIL. At least `_shared/Primitives.jsx` fails, reporting `oklch(`.

Record every file the run names. If files other than `_shared/Primitives.jsx` fail, do **not** widen the regex to make them pass — fix them the same way in Step 3, or if a literal is genuinely unavoidable, stop and report it rather than weakening the guard.

- [ ] **Step 3: Replace the literal with the token**

`design-system-docs/ui_kits/_shared/Primitives.jsx:19`. `colors_and_type.css` ships beside the kits in `BRAND_SOURCES`, so `var(--accent)` always resolves, and unlike the literal it follows `data-palette`.

Replace:

```jsx
    Miltinson<span style={{ color: 'oklch(72.5% 0.175 65)' }}>.</span>
```

With:

```jsx
    Miltinson<span style={{ color: 'var(--accent)' }}>.</span>
```

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run ui-kit-literals`
Expected: PASS, every file.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-patterns/src/artifacts/ui-kit-literals.test.mjs design-system-docs/ui_kits/_shared/Primitives.jsx
git commit -m "fix(brand): the kit wordmark follows the palette dial instead of a literal"
```

---

### Task 4: Changeset, and open PR 1

**Files:**

- Create: `.changeset/brand-boundary-rule.md`

- [ ] **Step 1: Write the changeset**

`packages/ai-patterns` gains a test and its shipped kit changes rendering under non-default palettes — a `patch`, since no export moves.

```markdown
---
'@elirobinson/ai-patterns': patch
---

The shipped wordmark follows the palette dial, and the UI kits are guarded against
colour literals.

`ui_kits/_shared/Primitives.jsx` painted the wordmark's period `oklch(72.5% 0.175 65)` —
`--signal-500` under `ember`, written as a constant. It was the only colour literal in the
13 shipped kit files, so the wordmark stayed amber under `data-palette="slate"` and under
`data-palette="miltinson"`, which is the palette miltinsons.com actually renders in. It now
reads `var(--accent)`.

The reason it survived is that `eslint.config.mjs` ignores `design-system-docs/**`
wholesale, so `no-hardcoded-design-values` never saw it. The kits are static JSX with no
build step, so un-ignoring them would cascade; a test guards the tree instead.
```

- [ ] **Step 2: Stage the changeset and verify it registers**

`changeset status` reads through git, so an untracked changeset is invisible.

```bash
git add .changeset/brand-boundary-rule.md
pnpm changeset status
```

Expected: `@elirobinson/ai-patterns` listed as `patch`.

- [ ] **Step 3: Full local verification**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: all pass. If `pnpm test` fails in a package this PR did not touch, check for a baseline-regen commit on `main` before debugging.

- [ ] **Step 4: Commit and open the PR**

```bash
git add .changeset/brand-boundary-rule.md
git commit -m "chore(changeset): brand boundary rule and the kit wordmark fix"
git push -u origin claude/brand-boundary-rule
gh pr create --title "docs(agents): the brand boundary rule, plus the two fixes that stand regardless" --body "$(cat <<'BODY'
Writes the boundary rule down where a contributor hits it, and lands the two items #145 flags as correct under every outcome.

- `docs/agents/brand-boundary.md` — the rule, the nine-row verdict table, the permitted-files table Task 16's test will read, and the two cases named as unsettled rather than dropped.
- The invoice pattern no longer renders a real postal address and email on the public `/brand/patterns`.
- The kit wordmark reads `var(--accent)` instead of an amber literal, guarded by a test.

Spec: `docs/superpowers/specs/2026-08-26-brand-boundary-design.md`

Refs #145

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

- [ ] **Step 5: Confirm the PR is mergeable and running**

Run: `gh pr view --json mergeable,mergeStateStatus,statusCheckRollup`
Expected: `mergeable: MERGEABLE`. A `CONFLICTING` PR runs zero workflows silently — rebase before waiting on checks.

---

# PR 2 — the pack, and the surfaces generated from it (#142)

Branch: `claude/voice-pack-source`. Depends on PR 1 being merged.

**Open this PR by re-measuring #142.** Its body was written at 09:12 UTC on 2026-08-26; #136 merged at 19:18 UTC the same day and removed one of its three copies. Post a comment on #142 with the current numbers before closing anything against it.

### Task 5: The schema

**Files:**

- Create: `packages/ai-patterns/src/voice/schema.mjs`
- Create: `packages/ai-patterns/src/voice/schema.test.mjs`

**Interfaces:**

- Produces:
  - `VOICE_SECTIONS: Array<{ key: string, level: 'system' | 'product', required: boolean }>`
  - `validatePack(pack: object): object` — returns the pack, or throws `Error` naming the failing field path.

- [ ] **Step 1: Write the failing test**

Create `packages/ai-patterns/src/voice/schema.test.mjs`:

```javascript
import { describe, expect, it } from 'vitest';

import { validatePack, VOICE_SECTIONS } from './schema.mjs';

const minimal = () => ({
  id: 'example',
  label: 'Example',
  person: { guidance: 'g', anchors: { asPerson: 'p', asCompany: 'c' } },
  tone: [{ name: 'Practical', gloss: 'g' }],
  casing: ['c'],
  words: { use: ['build'], avoid: ['synergy'] },
  emoji: { guidance: 'g', allowed: ['✓'] },
  anchors: ['a'],
  taglines: ['t'],
});

describe('VOICE_SECTIONS', () => {
  it('marks every section product-level until #159 question 1 is decided', () => {
    expect(VOICE_SECTIONS.every((section) => section.level === 'product')).toBe(true);
  });

  it('has no duplicate keys', () => {
    const keys = VOICE_SECTIONS.map((section) => section.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('validatePack', () => {
  it('returns a valid pack', () => {
    const pack = minimal();
    expect(validatePack(pack)).toBe(pack);
  });

  it('names the missing field rather than failing generically', () => {
    const pack = minimal();
    delete pack.words;
    expect(() => validatePack(pack)).toThrow(/words/);
  });

  it('names a nested missing field by its path', () => {
    const pack = minimal();
    delete pack.words.avoid;
    expect(() => validatePack(pack)).toThrow(/words\.avoid/);
  });

  it('rejects an empty enumeration, which is almost always a bad merge', () => {
    const pack = minimal();
    pack.words.use = [];
    expect(() => validatePack(pack)).toThrow(/words\.use/);
  });

  it('ignores unknown fields so an older schema is not broken by a newer pack', () => {
    const pack = { ...minimal(), somethingNewer: true };
    expect(() => validatePack(pack)).not.toThrow();
  });

  it('requires an id and a label, which name the pack in every rendered output', () => {
    const pack = minimal();
    delete pack.id;
    expect(() => validatePack(pack)).toThrow(/id/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/schema`
Expected: FAIL — `Cannot find module './schema.mjs'`.

- [ ] **Step 3: Implement the schema**

Create `packages/ai-patterns/src/voice/schema.mjs`:

```javascript
/* The shape of a voice pack.
 *
 * A pack is the prose equivalent of a palette: a named set of values a consumer may swap
 * wholesale. The system ships this schema and one pack; a consumer's own pack fills the
 * same slots. See docs/agents/brand-boundary.md.
 *
 * Every section is marked `product` today. `system` exists in the schema from day one
 * because #159 open question 1 — whether the avoid list is a blocklist any brand would
 * accept — is deliberately unsettled, and promoting one section later should be a
 * one-field change rather than a format change.
 */

/** @type {Array<{key: string, level: 'system'|'product', required: boolean}>} */
export const VOICE_SECTIONS = [
  { key: 'person', level: 'product', required: true },
  { key: 'tone', level: 'product', required: true },
  { key: 'casing', level: 'product', required: true },
  { key: 'words', level: 'product', required: true },
  { key: 'emoji', level: 'product', required: true },
  { key: 'anchors', level: 'product', required: true },
  { key: 'taglines', level: 'product', required: true },
];

/* Field paths that must be present, and must not be empty when they are arrays. An
   empty enumeration passes a naive presence check and is almost always a bad merge,
   which is the failure this schema exists to make loud. */
const REQUIRED_PATHS = [
  'id',
  'label',
  'person.guidance',
  'person.anchors.asPerson',
  'person.anchors.asCompany',
  'tone',
  'casing',
  'words.use',
  'words.avoid',
  'emoji.guidance',
  'anchors',
  'taglines',
];

function at(pack, path) {
  return path.split('.').reduce((value, key) => (value == null ? value : value[key]), pack);
}

/**
 * @param {object} pack
 * @returns {object} the same pack, for chaining
 * @throws {Error} naming the first failing field path
 */
export function validatePack(pack) {
  if (pack == null || typeof pack !== 'object') {
    throw new Error('voice pack: expected an object');
  }

  for (const path of REQUIRED_PATHS) {
    const value = at(pack, path);

    if (value === undefined || value === null || value === '') {
      throw new Error(`voice pack "${pack.id ?? '(no id)'}": missing ${path}`);
    }

    if (Array.isArray(value) && value.length === 0) {
      throw new Error(
        `voice pack "${pack.id}": ${path} is empty. An empty enumeration is almost ` +
          'always a bad merge — remove the field or give it values.',
      );
    }
  }

  return pack;
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/schema`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-patterns/src/voice/schema.mjs packages/ai-patterns/src/voice/schema.test.mjs
git commit -m "feat(ai-patterns): the voice pack schema"
```

---

### Task 6: Author the Miltinson pack, and prove it round-trips

This is the task that makes PR 2 provably a re-hosting rather than a rewrite. The renderer's output must equal the README's current section **byte for byte**.

**Files:**

- Create: `design-system-docs/miltinson.voice.json`
- Create: `packages/ai-patterns/src/voice/render.mjs`
- Create: `packages/ai-patterns/src/voice/render.test.mjs`

**Interfaces:**

- Consumes: `validatePack` from `./schema.mjs`.
- Produces:
  - `renderVoice(pack: object): string` — the markdown body of `## CONTENT FUNDAMENTALS`, with no leading or trailing blank line.
  - `renderVoiceCard(pack: object): string` — the inner HTML for `guidelines/brand-voice.html`.
  - `toneSummary(pack: object): string` — the comma-joined lowercase tone names, for `contracts.json`.

- [ ] **Step 1: Capture the current section as the fixture**

Do not retype it. Extract the bytes that ship today:

```bash
mkdir -p packages/ai-patterns/src/voice/__fixtures__
node -e "
const fs = require('node:fs');
const readme = fs.readFileSync('design-system-docs/README.md', 'utf8');
const m = readme.match(/^## CONTENT FUNDAMENTALS\s*\n([\s\S]*?)(?=\n## )/m);
if (!m) throw new Error('no CONTENT FUNDAMENTALS section');
fs.writeFileSync('packages/ai-patterns/src/voice/__fixtures__/content-fundamentals.md', m[1]);
"
wc -l packages/ai-patterns/src/voice/__fixtures__/content-fundamentals.md
```

Expected: roughly 53 lines. This file is the contract for Step 4.

- [ ] **Step 2: Write the failing test**

Create `packages/ai-patterns/src/voice/render.test.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { renderVoice, renderVoiceCard, toneSummary } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pack = JSON.parse(
  readFileSync(
    join(here, '..', '..', '..', '..', 'design-system-docs', 'miltinson.voice.json'),
    'utf8',
  ),
);
const shipped = readFileSync(join(here, '__fixtures__', 'content-fundamentals.md'), 'utf8');

describe('renderVoice', () => {
  /* The whole point of PR 2: the pack is a re-hosting of the section, not a rewrite.
     If this fails, the pack lost or gained a word — fix the pack, never the fixture. */
  it('reproduces the shipped CONTENT FUNDAMENTALS section byte for byte', () => {
    expect(renderVoice(pack)).toBe(shipped.trim());
  });

  it('numbers the tone ranking, so the weighting is rendered and not just listed', () => {
    expect(renderVoice(pack)).toContain('1. **Practical**');
    expect(renderVoice(pack)).toContain('4. **Quietly confident**');
  });
});

describe('renderVoiceCard', () => {
  it('carries the whole avoid list, not the half the hand-kept card shipped', () => {
    const card = renderVoiceCard(pack);
    for (const word of ['robust', 'world-class', 'frictionless', 'cutting-edge']) {
      expect(card).toContain(word);
    }
  });

  it('carries the whole use list', () => {
    const card = renderVoiceCard(pack);
    for (const word of pack.words.use) expect(card).toContain(word);
  });

  it('opens with the @dsCard marker the Design System pane indexes on', () => {
    expect(renderVoiceCard(pack).startsWith('<!-- @dsCard ')).toBe(true);
  });
});

describe('toneSummary', () => {
  it('keeps all four steps, unlike the flattened copy in contracts.json', () => {
    expect(toneSummary(pack)).toBe('practical, honest, warm, quietly confident');
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/render`
Expected: FAIL — `Cannot find module './render.mjs'`.

- [ ] **Step 4: Author the pack and the renderer together, iterating on the byte test**

Create `design-system-docs/miltinson.voice.json` by transcribing `README.md:61-114` into the schema — every word of both lists, all four tone steps, all five anchors, all four taglines. Then create `packages/ai-patterns/src/voice/render.mjs`.

Work Step 4 as a loop: run the test, read the diff, and **change the pack or the renderer — never the fixture**. The fixture is what ships today; if the diff is real, the pack is wrong.

```javascript
/* Pack → the forms each surface needs.
 *
 * Pure: no filesystem, no resolution. Callers hand in a validated pack.
 *
 * renderVoice's output is asserted byte-identical to the CONTENT FUNDAMENTALS section
 * that shipped before the pack existed, which is what makes the move a re-hosting
 * rather than a rewrite.
 */

import { validatePack } from './schema.mjs';

const list = (items) => items.join(', ');

/** The markdown body of `## CONTENT FUNDAMENTALS`. No leading or trailing blank line. */
export function renderVoice(pack) {
  validatePack(pack);

  return [
    `How ${pack.label} copy is written. Read this before writing for the brand.`,
    '',
    '### Voice',
    '',
    ...pack.person.guidance.split('\n'),
    '',
    '### Tone (in order of weight)',
    '',
    ...pack.tone.map((step, index) => `${index + 1}. **${step.name}** — ${step.gloss}`),
    '',
    '### Casing & punctuation',
    '',
    ...pack.casing.map((rule) => `- ${rule}`),
    '',
    '### Words to use',
    '',
    list(pack.words.use),
    '',
    '### Words to avoid',
    '',
    list(pack.words.avoid),
    '',
    '### Emoji',
    '',
    ...pack.emoji.guidance.split('\n'),
    '',
    '### Sample copy snippets (real, from the site — use as anchors)',
    '',
    ...pack.anchors.map((line) => `- _"${line}"_`),
    '',
    '### Generated taglines (write more in this style)',
    '',
    ...pack.taglines.map((line) => `- "${line}"`),
    '',
    '---',
  ].join('\n');
}

/** The full card for guidelines/brand-voice.html, marker included. */
export function renderVoiceCard(pack) {
  validatePack(pack);

  return [
    `<!-- @dsCard group="Brand" viewport="700x320" name="Voice" subtitle="${pack.label}, sentence case, em-dashes, no hype words" -->`,
    '<!doctype html><html><head><meta charset="utf-8">',
    '<link rel="stylesheet" href="../styles.css">',
    '<style>body{margin:0;padding:20px;background:var(--bg);font-family:var(--font-sans)}',
    '.lbl{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3)}</style>',
    '</head><body><div style="display:grid;gap:10px;max-width:600px">',
    `<div><p class="lbl" style="margin:0 0 4px">As a person</p><p class="t-body" style="margin:0">${pack.person.anchors.asPerson}</p></div>`,
    `<div><p class="lbl" style="margin:0 0 4px">As a company</p><p class="t-body" style="margin:0">${pack.person.anchors.asCompany}</p></div>`,
    `<p class="t-body-sm" style="margin:0"><b>Use:</b> ${list(pack.words.use)}.</p>`,
    `<p class="t-body-sm" style="margin:0"><b>Avoid:</b> ${list(pack.words.avoid)}.</p>`,
    '</div></body></html>',
  ].join('');
}

/** The tone ranking as one line, for contracts.json. */
export function toneSummary(pack) {
  validatePack(pack);
  return pack.tone.map((step) => step.name.toLowerCase()).join(', ');
}
```

- [ ] **Step 5: Run until green**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/render`
Expected: PASS, 6 tests. The byte-identity test passing is the gate for this whole PR.

- [ ] **Step 6: Commit**

```bash
git add design-system-docs/miltinson.voice.json packages/ai-patterns/src/voice/render.mjs packages/ai-patterns/src/voice/render.test.mjs packages/ai-patterns/src/voice/__fixtures__/content-fundamentals.md
git commit -m "feat(ai-patterns): the miltinson voice pack, and a renderer that reproduces the shipped section byte for byte"
```

---

### Task 7: Teach managed blocks to have names

`replaceManagedBlock` finds its markers with `indexOf`, so exactly one block per file is supported. `README.md` needs a second.

**Files:**

- Modify: `packages/ai-patterns/src/artifacts/brand.mjs:13-52`
- Modify: `packages/ai-patterns/src/artifacts/brand.test.mjs`

**Interfaces:**

- Produces: `replaceManagedBlock(source, replacement, label, note, name)` — a fifth optional parameter. Omitted or `undefined` keeps today's unnamed behaviour exactly, so `transformBrandDocs` needs no change.

- [ ] **Step 1: Write the failing test**

Append to `packages/ai-patterns/src/artifacts/brand.test.mjs`:

```javascript
describe('named managed blocks', () => {
  const doc = [
    'intro',
    '<!-- ds-artifacts:managed:begin -->',
    'old index',
    '<!-- ds-artifacts:managed:end -->',
    'middle',
    '<!-- ds-artifacts:managed:begin name="voice" -->',
    'old voice',
    '<!-- ds-artifacts:managed:end name="voice" -->',
    'outro',
  ].join('\n');

  it('replaces the named block and leaves the unnamed one alone', () => {
    const out = replaceManagedBlock(doc, 'NEW VOICE', 'doc', undefined, 'voice');
    expect(out).toContain('NEW VOICE');
    expect(out).toContain('old index');
    expect(out).not.toContain('old voice');
  });

  it('replaces the unnamed block and leaves the named one alone', () => {
    const out = replaceManagedBlock(doc, 'NEW INDEX', 'doc');
    expect(out).toContain('NEW INDEX');
    expect(out).toContain('old voice');
    expect(out).not.toContain('old index');
  });

  it('throws naming the block when it is absent', () => {
    expect(() => replaceManagedBlock(doc, 'x', 'doc', undefined, 'missing')).toThrow(/missing/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run artifacts/brand`
Expected: FAIL — the named block is not replaced, because `indexOf` finds the unnamed markers first.

- [ ] **Step 3: Implement named markers**

In `packages/ai-patterns/src/artifacts/brand.mjs`, replace the body of `replaceManagedBlock` so the markers are computed from `name`, keeping the exported `BLOCK_BEGIN`/`BLOCK_END` constants unchanged for existing importers:

```javascript
const markers = (name) =>
  name === undefined
    ? { begin: BLOCK_BEGIN, end: BLOCK_END }
    : {
        begin: `<!-- ds-artifacts:managed:begin name="${name}" -->`,
        end: `<!-- ds-artifacts:managed:end name="${name}" -->`,
      };

/**
 * @param {string} source
 * @param {string} replacement text to put between the markers
 * @param {string} label file name, for the error message
 * @param {string} note provenance comment written just inside the block
 * @param {string} [name] block name; omit for the original unnamed block
 */
export function replaceManagedBlock(
  source,
  replacement,
  label = 'document',
  note = GENERATED_NOTE,
  name = undefined,
) {
  const { begin, end } = markers(name);
  const start = source.indexOf(begin);
  const finish = source.indexOf(end);

  if (start === -1 || finish === -1 || finish < start) {
    throw new Error(
      `${label} has no ${begin} … ${end} block. ` +
        'The consumer copy of this file is generated from that block; add it back or ' +
        'update packages/ai-patterns/src/artifacts/brand.mjs.',
    );
  }

  return [
    source.slice(0, start),
    begin,
    '\n',
    note,
    '\n\n',
    replacement.trim(),
    '\n\n',
    source.slice(finish),
  ].join('');
}
```

- [ ] **Step 4: Run the whole brand suite, not just the new tests**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run artifacts/brand`
Expected: PASS, including every pre-existing test. The unnamed path must be untouched.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-patterns/src/artifacts/brand.mjs packages/ai-patterns/src/artifacts/brand.test.mjs
git commit -m "feat(ai-patterns): managed blocks can be named, so one file can hold two"
```

---

### Task 8: Generate the three surfaces from the pack

**Files:**

- Modify: `design-system-docs/README.md` (wrap `## CONTENT FUNDAMENTALS` in a named block)
- Modify: `packages/ai-patterns/src/artifacts/llms.mjs` (`brandVoice` strips HTML comments)
- Modify: `packages/ai-patterns/scripts/build-design-project.mjs` (write the voice card)
- Modify: `packages/ai-patterns/src/contracts.json` + whatever generates it
- Create: `packages/ai-patterns/scripts/sync-voice.mjs`
- Create: `packages/ai-patterns/src/voice/sync.test.mjs`

**Interfaces:**

- Consumes: `renderVoice`, `renderVoiceCard`, `toneSummary` from `../src/voice/render.mjs`; `replaceManagedBlock` with `name`.
- Produces: `packages/ai-patterns/scripts/sync-voice.mjs`, runnable as `node packages/ai-patterns/scripts/sync-voice.mjs [--check]`. `--check` exits non-zero and prints a diff when a generated surface is stale.

- [ ] **Step 1: Add the named markers to the README by hand, once**

Insert `<!-- ds-artifacts:managed:begin name="voice" -->` on its own line immediately **after** the `## CONTENT FUNDAMENTALS` heading line, and `<!-- ds-artifacts:managed:end name="voice" -->` on its own line immediately **before** the `## VISUAL FOUNDATIONS` heading. The heading itself stays outside the block so `brandVoice()`'s regex still anchors on it.

- [ ] **Step 2: Make `brandVoice` strip HTML comments**

The markers now sit inside the range `brandVoice()` extracts, and would otherwise change `llms-full.txt` byte-for-byte. In `packages/ai-patterns/src/artifacts/llms.mjs`, in `brandVoice`, strip comments from the captured section before returning:

```javascript
return section[1].replace(/<!--[\s\S]*?-->\n?/g, '').trim();
```

- [ ] **Step 3: Write the failing sync test**

Create `packages/ai-patterns/src/voice/sync.test.mjs`:

```javascript
/* The generated surfaces, checked against the pack.
 *
 * This is the test that makes the pack the single source rather than a fourth copy:
 * it fails when any surface drifts, which is what the four hand-kept copies could
 * never do.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { brandVoice } from '../artifacts/llms.mjs';
import { renderVoice, toneSummary } from './render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const read = (path) => readFileSync(join(repo, path), 'utf8');
const pack = JSON.parse(read('design-system-docs/miltinson.voice.json'));

describe('the generated surfaces match the pack', () => {
  it('sync-voice --check passes, so nothing is stale', () => {
    expect(() =>
      execFileSync('node', ['packages/ai-patterns/scripts/sync-voice.mjs', '--check'], {
        cwd: repo,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('brandVoice still returns the section, with the markers stripped', () => {
    const extracted = brandVoice(read('design-system-docs/README.md'));
    expect(extracted).toBe(renderVoice(pack));
    expect(extracted).not.toContain('ds-artifacts:managed');
  });

  it('the brand guidelines card carries the full avoid list', () => {
    const card = read('design-system-docs/guidelines/brand-voice.html');
    for (const word of pack.words.avoid) expect(card).toContain(word);
  });

  it('contracts.json carries all four tone steps', () => {
    const contracts = JSON.parse(read('packages/ai-patterns/src/contracts.json'));
    expect(contracts.systemPromptStyle.voice).toBe(toneSummary(pack));
  });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/sync`
Expected: FAIL — `sync-voice.mjs` does not exist, the card is the hand-kept 8/7 version, and `contracts.json` still reads `"practical, honest, warm"`.

- [ ] **Step 5: Write the sync script**

Create `packages/ai-patterns/scripts/sync-voice.mjs`:

```javascript
/* Writes every surface derived from the voice pack.
 *
 * The word lists lived in hand-kept copies that disagreed — the fullest reached agents
 * and the shortest reached humans. One source, written out; `--check` is the CI form.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { replaceManagedBlock } from '../src/artifacts/brand.mjs';
import { renderVoice, renderVoiceCard, toneSummary } from '../src/voice/render.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const at = (path) => join(repo, path);
const pack = JSON.parse(readFileSync(at('design-system-docs/miltinson.voice.json'), 'utf8'));

const README = 'design-system-docs/README.md';
const CARD = 'design-system-docs/guidelines/brand-voice.html';
const CONTRACTS = 'packages/ai-patterns/src/contracts.json';

function readmeWithVoice() {
  return replaceManagedBlock(
    readFileSync(at(README), 'utf8'),
    renderVoice(pack),
    README,
    '<!-- Generated from design-system-docs/miltinson.voice.json. Do not edit. -->',
    'voice',
  );
}

function contractsWithTone() {
  const contracts = JSON.parse(readFileSync(at(CONTRACTS), 'utf8'));
  contracts.systemPromptStyle.voice = toneSummary(pack);
  return `${JSON.stringify(contracts, null, 2)}\n`;
}

const surfaces = [
  { path: README, contents: readmeWithVoice() },
  { path: CARD, contents: `${renderVoiceCard(pack)}\n` },
  { path: CONTRACTS, contents: contractsWithTone() },
];

const check = process.argv.includes('--check');
const stale = surfaces.filter(({ path, contents }) => readFileSync(at(path), 'utf8') !== contents);

if (check) {
  if (stale.length > 0) {
    console.error(
      `Stale, regenerate with \`node packages/ai-patterns/scripts/sync-voice.mjs\`:\n` +
        stale.map(({ path }) => `  ${path}`).join('\n'),
    );
    process.exit(1);
  }
  console.log('voice surfaces are in sync');
} else {
  for (const { path, contents } of stale) {
    writeFileSync(at(path), contents);
    console.log(`wrote ${path}`);
  }
}
```

- [ ] **Step 6: Run the sync, and read the diff before trusting it**

```bash
node packages/ai-patterns/scripts/sync-voice.mjs
git diff --stat
git diff design-system-docs/README.md
```

Expected: `README.md` gains only the two marker lines and the generated note — **the prose between them must be unchanged**, because Task 6 asserted byte identity. `brand-voice.html` gains the missing half of both word lists. `contracts.json` gains `quietly confident`.

If the README prose changed, stop: Task 6's fixture test is passing on a stale fixture. Re-run Task 6 Step 1 and fix the pack.

- [ ] **Step 7: Wire the card into the design-project build**

`packages/ai-patterns/scripts/build-design-project.mjs:203` currently declares the editorial `guidelines/` cards untouched. `brand-voice.html` is now generated, so amend that comment to name the one exception and leave the rest of the rule intact.

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run`
Expected: PASS, whole package — including `llms.test.mjs`, which asserts the corpus contents. If a `llms` test fails on the markers, Step 2's comment-stripping is wrong; fix that rather than the test.

- [ ] **Step 9: Verify the built corpus is unchanged**

```bash
pnpm nx build ai-patterns
grep -c "CONTENT FUNDAMENTALS" packages/ai-patterns/dist/artifacts/skills/design-system-reference/llms-full.txt
grep -n "ds-artifacts:managed" packages/ai-patterns/dist/artifacts/skills/design-system-reference/llms-full.txt || echo "no markers leaked — correct"
```

Expected: the section is present once, and no marker leaked into the corpus.

- [ ] **Step 10: Commit**

```bash
git add design-system-docs/README.md design-system-docs/guidelines/brand-voice.html packages/ai-patterns/src/contracts.json packages/ai-patterns/src/artifacts/llms.mjs packages/ai-patterns/scripts/sync-voice.mjs packages/ai-patterns/scripts/build-design-project.mjs packages/ai-patterns/src/voice/sync.test.mjs
git commit -m "feat(ai-patterns): every voice surface is generated from the pack"
```

---

### Task 9: Re-point the docs voice page, changeset, and open PR 2

**Files:**

- Modify: `apps/docs/src/app/(docs)/guidelines/voice/page.mdx` (closing paragraph only)
- Create: `.changeset/voice-pack-single-source.md`

- [ ] **Step 1: Re-point the link**

The page already declines to copy the brand half — #136 saw to that. Only the pointer changes. Replace the closing paragraph's reference to `design-system-docs/README.md` under **CONTENT FUNDAMENTALS** with the pack:

```mdx
Miltinson's own brand voice — how it addresses a reader, its casing and punctuation
conventions, its word lists, its iconography — is a **voice pack**:
`design-system-docs/miltinson.voice.json`. Every surface that shows it is generated from
that one file, so the copies cannot disagree again. It is the pack this system ships by
default, not a rule of the system; a product declares its own with `ds init --voice`.
```

- [ ] **Step 2: Write the changeset**

```markdown
---
'@elirobinson/ai-patterns': minor
---

The brand voice is a pack, and every surface that shows it is generated from that one file.

The use/avoid word lists were hand-kept in two places that had already diverged, and the
divergence ran the wrong way: `README.md` (19 use / 15 avoid) reaches agents through
`/llms-full.txt`, while `guidelines/brand-voice.html` (8 / 7) is the page a person opens.
A third copy in `apps/docs` was removed by #136. A fourth fact, `contracts.json`'s
`systemPromptStyle.voice`, flattened the four-step tone ranking to three adjectives.

All of them now derive from `design-system-docs/miltinson.voice.json`.
`packages/ai-patterns/scripts/sync-voice.mjs --check` fails the build when one drifts.

The move is deliberately a re-hosting and not a rewrite: a test asserts the rendered
`## CONTENT FUNDAMENTALS` section is byte-identical to the one that shipped before, so
`/llms-full.txt` and the packed skill are unchanged by this release.
```

- [ ] **Step 3: Verify and open**

```bash
git add .changeset/voice-pack-single-source.md
pnpm changeset status
pnpm lint && pnpm typecheck && pnpm test
```

Expected: `@elirobinson/ai-patterns` listed as `minor`; all checks pass.

- [ ] **Step 4: Re-measure #142 before closing anything against it**

```bash
gh issue comment 142 -R EliRobinson/design-system --body "$(cat <<'BODY'
Re-measured before working this, because the body is stale: it was filed at 09:12 UTC on 2026-08-26 and #136 merged at 19:18 UTC the same day.

- The `apps/docs` copy is **gone** — #136 rewrote that page to link the brand half rather than copy it.
- `README.md` is now **19 use / 15 avoid** (was 19/16); `brand-voice.html` is **8 / 7** (was 8/8). Both avoid lists lost `"we" (when Eli means "I")` when the royal-we rule was retired.
- So: two live copies, not three.

The sharpest finding is unchanged and is the reason this is worth doing — the most complete copy is the one no human reads, and the least complete is the one every human reads.

Closing via #145's PR 2, which makes `design-system-docs/miltinson.voice.json` the single source and generates every surface from it.
BODY
)"
```

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "chore(changeset): the voice pack as single source"
git push -u origin claude/voice-pack-source
gh pr create --title "feat(ai-patterns): the brand voice is a pack, and every surface is generated from it" --body "$(cat <<'BODY'
Closes #142 by making `design-system-docs/miltinson.voice.json` the only hand-kept copy of the voice.

A test asserts the rendered `## CONTENT FUNDAMENTALS` section is **byte-identical** to the one that shipped before this PR, so the corpus and the packed skill are unchanged — this is a re-hosting, not a rewrite.

`brand-voice.html` gains the half of the avoid list it was missing (`robust`, `world-class`, `frictionless`, `cutting-edge`, `reimagine`, `ninja`, `rockstar`), and `contracts.json` gains the fourth tone step.

Spec: `docs/superpowers/specs/2026-08-26-brand-boundary-design.md`

Closes #142. Refs #145

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
gh pr view --json mergeable,mergeStateStatus
```

---

# PR 3 — the dial

Branch: `claude/voice-pack-dial`. Depends on PR 2. This is the PR that makes the boundary real: after it, the shipped voice is labelled a default rather than asserted as a rule.

### Task 10: Resolve a consumer's pack ahead of the default

**Files:**

- Create: `packages/ai-patterns/src/voice/resolve.mjs`
- Create: `packages/ai-patterns/src/voice/resolve.test.mjs`
- Create: `packages/ai-patterns/src/voice/starter.voice.json`

**Interfaces:**

- Consumes: `validatePack` from `./schema.mjs`.
- Produces: `resolveVoicePack({ cwd: string }): { pack: object, source: 'consumer' | 'default', path: string }`.

- [ ] **Step 1: Write the failing test**

Create `packages/ai-patterns/src/voice/resolve.test.mjs`:

```javascript
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveVoicePack } from './resolve.mjs';

const scratch = () => mkdtempSync(join(tmpdir(), 'voice-'));

const valid = {
  id: 'cabin',
  label: 'Cabin Whisperer',
  person: { guidance: 'g', anchors: { asPerson: 'p', asCompany: 'c' } },
  tone: [{ name: 'Warm', gloss: 'g' }],
  casing: ['c'],
  words: { use: ['stay'], avoid: ['synergy'] },
  emoji: { guidance: 'g', allowed: [] },
  anchors: ['a'],
  taglines: ['t'],
};

describe('resolveVoicePack', () => {
  it('falls back to the shipped pack, labelled as the default', () => {
    const result = resolveVoicePack({ cwd: scratch() });
    expect(result.source).toBe('default');
    expect(result.pack.id).toBe('miltinson');
  });

  it('prefers a consumer pack at the repo root', () => {
    const cwd = scratch();
    writeFileSync(join(cwd, 'voice.json'), JSON.stringify(valid));
    const result = resolveVoicePack({ cwd });
    expect(result.source).toBe('consumer');
    expect(result.pack.id).toBe('cabin');
  });

  /* The defect this whole design closes is getting someone else's voice silently.
     Falling back on a malformed pack would reintroduce it one layer down. */
  it('throws on a malformed consumer pack rather than falling back', () => {
    const cwd = scratch();
    writeFileSync(join(cwd, 'voice.json'), JSON.stringify({ id: 'broken' }));
    expect(() => resolveVoicePack({ cwd })).toThrow(/voice\.json/);
  });

  it('throws on unparseable JSON rather than falling back', () => {
    const cwd = scratch();
    writeFileSync(join(cwd, 'voice.json'), '{ not json');
    expect(() => resolveVoicePack({ cwd })).toThrow(/voice\.json/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/resolve`
Expected: FAIL — `Cannot find module './resolve.mjs'`.

- [ ] **Step 3: Implement the resolver**

```javascript
/* Which voice pack is in force.
 *
 * A consumer's own pack wins; the shipped Miltinson pack is the fallback and is always
 * labelled as such. Never an error for the consumer who has declared nothing — an empty
 * schema would be a real regression in what the tarball is worth, and the palette dial
 * does not behave that way either.
 *
 * A malformed consumer pack throws rather than falling back. Getting someone else's
 * voice silently is the defect this layer exists to close.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePack } from './schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/** The pack this system ships. Its values are one consumer's; its slot is the system's. */
export const DEFAULT_PACK_PATH = join(
  here,
  '..',
  '..',
  '..',
  '..',
  'design-system-docs',
  'miltinson.voice.json',
);

/** The filename a consumer declares by creating. Presence is the declaration. */
export const CONSUMER_PACK_FILE = 'voice.json';

/**
 * @param {{cwd?: string}} [options]
 * @returns {{pack: object, source: 'consumer'|'default', path: string}}
 */
export function resolveVoicePack({ cwd = process.cwd() } = {}) {
  const declared = join(cwd, CONSUMER_PACK_FILE);

  if (existsSync(declared)) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(declared, 'utf8'));
    } catch (cause) {
      throw new Error(`${CONSUMER_PACK_FILE} is not valid JSON: ${cause.message}`, { cause });
    }

    try {
      return { pack: validatePack(parsed), source: 'consumer', path: declared };
    } catch (cause) {
      throw new Error(`${CONSUMER_PACK_FILE} is not a valid voice pack: ${cause.message}`, {
        cause,
      });
    }
  }

  const pack = JSON.parse(readFileSync(DEFAULT_PACK_PATH, 'utf8'));
  return { pack: validatePack(pack), source: 'default', path: DEFAULT_PACK_PATH };
}
```

- [ ] **Step 4: Create the starter pack**

`packages/ai-patterns/src/voice/starter.voice.json`. It restates the schema with system defaults and **no brand's values** — the rule `product-token-layer.md:149` states for tokens. Every string is an instruction to the author, not Miltinson's answer:

```json
{
  "id": "your-product",
  "label": "Your Product",
  "person": {
    "guidance": "- **Pick the person from the product, not from a rule, and hold it.** The failure is a surface that switches partway through, not a surface that chose \"we\".\n- **Reader is \"you.\"** Direct address, no buffer.",
    "anchors": {
      "asPerson": "One real sentence from your product, written as a person.",
      "asCompany": "One real sentence from your product, written as a company."
    }
  },
  "tone": [
    { "name": "Practical", "gloss": "what the reader can actually use" },
    { "name": "Honest", "gloss": "no claim you cannot support" },
    { "name": "Warm", "gloss": "patient with a reader who is new to this" },
    { "name": "Quietly confident", "gloss": "let the work speak" }
  ],
  "casing": ["**Sentence case** for headings.", "**Title Case** for product and proper names."],
  "words": {
    "use": ["replace these with your own"],
    "avoid": ["synergy", "leverage", "unlock", "empower", "seamless"]
  },
  "emoji": { "guidance": "- **Sparingly**, or not at all in chrome.", "allowed": [] },
  "anchors": ["Replace with real copy from your product."],
  "taglines": ["Replace with your own."]
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run voice/resolve`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-patterns/src/voice/resolve.mjs packages/ai-patterns/src/voice/resolve.test.mjs packages/ai-patterns/src/voice/starter.voice.json
git commit -m "feat(ai-patterns): resolve a consumer's voice pack ahead of the shipped default"
```

---

### Task 11: `ds voice` and `ds init --voice`

**Files:**

- Modify: `packages/ai-patterns/src/cli/commands.mjs` (add `voice`, add to `usage()`)
- Modify: `packages/ai-patterns/src/cli/cli.mjs` (route it)
- Modify: `packages/ai-patterns/src/cli/init.mjs` (`--voice`)
- Modify: `packages/ai-patterns/src/cli/commands.test.mjs`

**Interfaces:**

- Consumes: `resolveVoicePack` from `../voice/resolve.mjs`; `renderVoice` from `../voice/render.mjs`.
- Produces: `voice(env): { text: string, exitCode: number }` — matching every other command's shape.

- [ ] **Step 1: Write the failing test**

Add to `packages/ai-patterns/src/cli/commands.test.mjs`:

```javascript
describe('ds voice', () => {
  it('names which pack is in force, so an inherited voice is visible not inferred', () => {
    const { text, exitCode } = voice({ cwd: mkdtempSync(join(tmpdir(), 'ds-')) });
    expect(exitCode).toBe(0);
    expect(text).toContain('pack: miltinson');
    expect(text).toContain('default');
    expect(text).toContain('ds init --voice');
  });

  it('renders the pack body', () => {
    const { text } = voice({ cwd: mkdtempSync(join(tmpdir(), 'ds-')) });
    expect(text).toContain('### Words to avoid');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run cli/commands`
Expected: FAIL — `voice` is not exported.

- [ ] **Step 3: Implement the command**

The test snippet above needs these imports at the top of `commands.test.mjs`, alongside whatever is already there:

```javascript
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { voice } from './commands.mjs';
```

And `commands.mjs` needs these two, added to its existing import block:

```javascript
import { renderVoice } from '../voice/render.mjs';
import { resolveVoicePack } from '../voice/resolve.mjs';
```

Then add the command itself. `ok()` is already defined in this file at `commands.mjs:21`:

```javascript
export function voice(env = {}) {
  const { pack, source, path } = resolveVoicePack({ cwd: env.cwd });

  const header =
    source === 'consumer'
      ? [`pack: ${pack.id} (${pack.label}) — yours, from ${path}`]
      : [
          `pack: ${pack.id} (${pack.label}) — the system default, not a rule of the system.`,
          'Declare your own with `ds init --voice`, then edit voice.json.',
        ];

  return ok([...header, '', renderVoice(pack)].join('\n'));
}
```

Add one line to `usage()`, in the existing column style:

```
  voice             The brand voice pack in force, and where it came from
```

- [ ] **Step 4: Add `--voice` to init**

In `packages/ai-patterns/src/cli/init.mjs`, `--voice` copies `starter.voice.json` to `<cwd>/voice.json`. It must refuse to overwrite an existing `voice.json` — a consumer's voice is hand-written and clobbering it is unrecoverable.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run cli/`
Expected: PASS.

- [ ] **Step 6: Verify end to end from a clean directory**

```bash
cd "$(mktemp -d)" && node "$OLDPWD/packages/ai-patterns/src/cli/cli.mjs" voice | head -5; cd -
```

Expected: the first lines name `pack: miltinson`, call it the system default, and point at `ds init --voice`.

- [ ] **Step 7: Commit**

```bash
git add packages/ai-patterns/src/cli/
git commit -m "feat(ai-patterns): ds voice, and ds init --voice"
```

---

### Task 12: Relabel the corpus and the MCP tool

This is where the shipped bytes stop asserting a business fact as a rule.

**Files:**

- Modify: `packages/ai-patterns/src/artifacts/llms.mjs:314-329`
- Modify: `packages/ai-patterns/src/artifacts/llms.test.mjs`
- Modify: `packages/design-system-mcp/src/server.mjs:461-508`
- Modify: `packages/design-system-mcp/src/environment.mjs` (`brandVoiceRules`)
- Modify: `packages/design-system-mcp/src/server.test.mjs`

**Interfaces:**

- Consumes: `resolveVoicePack`, `renderVoice`.
- Produces: no new exports; the corpus heading becomes `## Voice`.

- [ ] **Step 1: Write the failing tests**

In `packages/ai-patterns/src/artifacts/llms.test.mjs`:

```javascript
it('frames the voice as a replaceable pack, not as a rule of the system', () => {
  const full = llmsFull({ brand });
  expect(full).toContain('## Voice');
  expect(full).toContain('pack: miltinson');
  expect(full).not.toContain('these rules make it Miltinson');
});
```

In `packages/design-system-mcp/src/server.test.mjs`:

```javascript
it('get_brand_guidance names the pack and does not advertise making pages Miltinson', async () => {
  const text = await callTool('get_brand_guidance', {});
  expect(text).toContain('pack: miltinson');
  expect(text).toContain('default');
  expect(text).not.toContain('rather than merely correct');
});
```

- [ ] **Step 2: Run both and watch them fail**

```bash
pnpm --filter @elirobinson/ai-patterns exec vitest run artifacts/llms
pnpm --filter @elirobinson/design-system-mcp exec vitest run
```

Expected: both FAIL on the old framing.

- [ ] **Step 3: Rewrite the corpus section**

`llmsFull` currently takes `brand: { readme, note, artifacts }` (`llms.mjs:315-329`, built at `build-artifacts.mjs:212-219`). Add a fourth field, `packId`, so the corpus can name the pack without `llms.mjs` reading the filesystem — it is a pure renderer and must stay one.

In `packages/ai-patterns/scripts/build-artifacts.mjs`, extend the `brand` object passed to `llmsFull`:

```javascript
      brand: {
        readme: regenerated,
        packId: JSON.parse(
          readFileSync(join(brandSource, 'miltinson.voice.json'), 'utf8'),
        ).id,
        note: /* … unchanged … */,
        artifacts: brandManifest.artifacts.filter((artifact) => artifact.ships),
      },
```

Then in `llms.mjs`, replace the `## Brand` heading and its two-line blurb:

```javascript
parts.push(
  '',
  '## Voice',
  '',
  `The voice pack in force (pack: ${brand.packId}). Prop tables and tokens make a page`,
  'correct; a voice pack makes it sound like a particular product. This one is the',
  'default this system ships, not a rule of the system — a product declares its own',
  'with `ds init --voice` and this section follows it.',
);
```

Leave `brandVoice(brand.readme)` as the body source. The section's content is unchanged by this task; only its framing moves.

- [ ] **Step 4: Rewrite the MCP tool description and body**

In `server.mjs`, the `get_brand_guidance` description loses the Miltinson claim:

```javascript
      description:
        'The voice pack in force for this repo — words to use and avoid, tone, casing — ' +
        'plus the UI kit and asset pointers for the surface being built. Returns the ' +
        "consumer's own pack when one is declared, and the system's default pack otherwise.",
```

The returned body opens by naming the pack and its source, so a calling model can tell inherited voice from declared voice.

- [ ] **Step 5: Run both suites**

```bash
pnpm --filter @elirobinson/ai-patterns exec vitest run
pnpm --filter @elirobinson/design-system-mcp exec vitest run
```

Expected: PASS. Some existing assertions on `## Brand` will need updating — update them, they are asserting the old framing on purpose.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-patterns/src/artifacts/llms.mjs packages/ai-patterns/src/artifacts/llms.test.mjs packages/design-system-mcp/src/
git commit -m "feat: the shipped voice is labelled a default pack, not a rule of the system"
```

---

### Task 13: Changeset and open PR 3

- [ ] **Step 1: Write the changeset**

```markdown
---
'@elirobinson/ai-patterns': minor
'@elirobinson/design-system-mcp': minor
---

The brand voice is a dial now, and what ships is labelled a default rather than a rule.

`palettes.css` made this move for colour: Miltinson's colours were contributed as a named
palette and amber stayed the default without being a rule, because `data-palette` made
"default" mean something. Prose had no such dial, so the same 51 lines read as the system's
instruction rather than as one pack among possible packs.

A consumer declares its own voice by creating `voice.json` at its repo root — presence is
the declaration, there is no config key. `ds init --voice` scaffolds one. `ds voice` prints
the pack in force and where it came from.

`get_brand_guidance` and `/llms-full.txt` now name the active pack, and return the
consumer's when one is declared. A consumer that declares nothing still gets the full
default pack, not an empty schema: an empty schema would be a real regression in what the
tarball is worth. A malformed consumer pack throws rather than falling back, because
getting someone else's voice silently is the defect this layer closes.
```

- [ ] **Step 2: Verify and open**

```bash
git add .changeset/voice-pack-dial.md
pnpm changeset status
pnpm lint && pnpm typecheck && pnpm test
git commit -am "chore(changeset): the voice dial"
git push -u origin claude/voice-pack-dial
gh pr create --title "feat: the voice pack is a dial, and the shipped one is a default" --fill
gh pr view --json mergeable,mergeStateStatus
```

- [ ] **Step 3: Close #159 with its stale body corrected**

```bash
gh issue comment 159 -R EliRobinson/design-system --body "$(cat <<'BODY'
Closing as resolved, in two halves — and correcting the record, because this issue's body describes a page that no longer exists.

It was filed at 16:53 UTC on 2026-08-26; #136 merged at 19:18 UTC the same day. The opening line it quotes is gone, and so is the interleaving its table describes: the page now opens with the chrome/content distinction, keeps only the system-level half, and links the brand half rather than copying it. **That was the docs-side half of reading A**, already done.

The other half — reading A's "the brand voice needs a home", which is why it could not land without #145 — is #145's PR 3. The voice is a pack now, so the seam is mechanical rather than editorial: `schema.mjs` marks each section `system` or `product`.

Open questions 1 and 2 are deliberately **not** answered. Whether the avoid list is system-level is recorded as unsettled in `docs/agents/brand-boundary.md`, because promoting it would breach `patterns.md:84` — the carve-out forbidding the chrome rule from reaching editorial voice — and that deserves deciding on purpose rather than by implementation drift.

Your open question 3 proposed exactly the design that was built. Thank you for it.
BODY
)"
```

---

# PR 4 — the kits' strings, in one place

Branch: `claude/ui-kit-content-fixture`. Depends on PR 3 only for ordering; it is independent in code.

### Task 14: Extract the kits' Miltinson strings into one fixture

**Files:**

- Create: `design-system-docs/ui_kits/_shared/content.js`
- Modify: `design-system-docs/ui_kits/marketing/Sections.jsx`, `marketing/HeaderFooter.jsx`, `marketing/README.md`, `webapp/Components.jsx`, `mobile/Screens.jsx`, `docs/index.html`, `_shared/Primitives.jsx`
- Create: `packages/ai-patterns/src/artifacts/ui-kit-content.test.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces: `design-system-docs/ui_kits/_shared/content.js` with a default export. Task 16's permitted-files table must list it.

- [ ] **Step 1: Inventory what actually has to move**

```bash
grep -rn "Eli Robinson\|miltinsons\.com\|Kids Recipes\|Coaching\|Miltinson\|Maths" design-system-docs/ui_kits/ | tee /tmp/kit-strings.txt
wc -l /tmp/kit-strings.txt
```

Expected: roughly 44 lines across 13 files. Work from this list; it is the task's definition of done.

- [ ] **Step 2: Write the failing test**

Create `packages/ai-patterns/src/artifacts/ui-kit-content.test.mjs`:

```javascript
/* The kits' strings live in one file.
 *
 * The kit taxonomy — marketing, webapp, mobile, docs — is the system's, and it is worth
 * shipping. The strings inside were one company's, spread across 13 files, where a
 * reskin meant 44 edits and a re-crossing of the boundary was invisible. One fixture
 * makes a reskin a one-file job and gives the boundary test a single file to permit.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const kitsDir = join(here, '..', '..', '..', '..', 'design-system-docs', 'ui_kits');
const FIXTURE = '_shared/content.js';

const BRAND_TERMS = [
  'Eli Robinson',
  'miltinsons.com',
  'Kids Recipes',
  'Coaching Guides',
  'Miltinson Technologies',
  'CoachingBand',
  'RecipesScreen',
  'MathsScreen',
];

function kitFiles(dir = kitsDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return kitFiles(path);
    if (!/\.(jsx|html|md)$/.test(entry.name)) return [];
    return [{ file: relative(kitsDir, path), source: readFileSync(path, 'utf8') }];
  });
}

describe('the kits carry no brand strings outside the content fixture', () => {
  const files = kitFiles().filter(({ file }) => file.replace(/\\/g, '/') !== FIXTURE);

  it.each(files)('$file', ({ source }) => {
    expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run ui-kit-content`
Expected: FAIL across roughly 7 files, each naming the terms it carries.

- [ ] **Step 4: Create the fixture and rewire the kits**

`design-system-docs/ui_kits/_shared/content.js` holds every string from Step 1's inventory, grouped by kit. The kits import from it. Rename the components the inventory names — `CoachingBand` → `FeatureBand`, `RecipesScreen` → `BrowseScreen`, `MathsScreen` → `PracticeScreen` — and update every import and export site, including `marketing/Sections.jsx:359`.

Keep `marketing/README.md`'s description accurate: it is a recreation of a real homepage, so say what the layout is rather than whose site it was.

- [ ] **Step 5: Run both kit tests**

```bash
pnpm --filter @elirobinson/ai-patterns exec vitest run ui-kit
```

Expected: PASS — both `ui-kit-content` and Task 3's `ui-kit-literals`. If a kit file no longer parses, the rename missed an import site.

- [ ] **Step 6: Verify the kits still ship complete**

```bash
pnpm nx build ai-patterns
ls packages/ai-patterns/dist/artifacts/skills/miltinson-design/ui_kits/_shared/
```

Expected: `content.js` is present. `BRAND_SOURCES` ships `ui_kits` whole, so a new file in the tree needs no manifest change — but confirm rather than assume, because a kit that imports a file the tarball lacks is a dangling import in every consumer, which is exactly the defect the `BRAND_SOURCES` docblock records.

- [ ] **Step 7: Changeset, commit, open PR 4**

```markdown
---
'@elirobinson/ai-patterns': patch
---

The shipped UI kits keep their structure and hand their strings to one file.

The four kits — marketing, webapp, mobile, docs — are useful surface archetypes and that
taxonomy is the system's. The 44 Miltinson strings spread across 13 of their files were
not: a reskin meant 44 edits, and a re-crossing of the boundary was invisible.

Everything a consumer would have to rewrite now lives in `ui_kits/_shared/content.js`.
Three components are renamed for the same reason: `CoachingBand` → `FeatureBand`,
`RecipesScreen` → `BrowseScreen`, `MathsScreen` → `PracticeScreen`.
```

```bash
git add -A && pnpm changeset status && pnpm test
git commit -m "refactor(brand): the kits' strings move into one content fixture"
git push -u origin claude/ui-kit-content-fixture && gh pr create --fill
```

---

# PR 5 — the test that makes it stick

Branch: `claude/brand-boundary-test`. Depends on PRs 1–4, because it fails until the moves are done.

### Task 15: Amend the two documents this design contradicts

Do this before the test, so the test is written against documents that agree with it.

**Files:**

- Modify: `docs/agents/product-token-layer.md:149`
- Modify: `packages/ai-patterns/src/artifacts/guideline-cards.mjs:9-11`

- [ ] **Step 1: Say why a palette differs from a product value**

`product-token-layer.md:149` reads "**No product's own values ship here.** … A product's palette lives in the product", which taken alone condemns `[data-palette='miltinson']`. Append the distinction:

```markdown
This is about `--product-*`, not about palettes, and the difference is worth stating
because the two rules look contradictory otherwise. A palette is inert until a consumer
selects it and every combination it introduces is measured by `contrast.test.mjs`; a
`--product-*` value applies wherever its scope does and no gate can see it. So
`[data-palette='miltinson']` is the system's and a `--product-signal` of Miltinson's
would not be. See [Brand boundary](./brand-boundary.md).
```

- [ ] **Step 2: Amend the guideline-cards docblock**

It says brand voice is "writing, not data" and is not generated. Half of that is now false. Amend to record which half and why:

```javascript
 * Only the enumerations live here. Cards that carry editorial judgement — the wordmark
 * rules, type specimens, "spacing in use" — are writing, not data, and are mirrored from
 * the design project instead.
 *
 * brand-voice.html used to be in that list and no longer is. Its word lists are
 * enumerations wearing prose clothing, which is exactly why they drifted: the hand-kept
 * card shipped 8 of 19 use words and 7 of 15 avoid words to the page a human opens, while
 * the fullest copy reached only agents. It is generated from the voice pack by
 * scripts/sync-voice.mjs. The prose around the lists is still writing.
```

- [ ] **Step 3: Commit**

```bash
git add docs/agents/product-token-layer.md packages/ai-patterns/src/artifacts/guideline-cards.mjs
git commit -m "docs: reconcile the token-layer rule and the guideline-cards docblock with the brand boundary"
```

---

### Task 16: The boundary test

**Files:**

- Create: `packages/ai-patterns/src/artifacts/brand-boundary.test.mjs`

**Interfaces:**

- Consumes: `docs/agents/brand-boundary.md`'s `## Permitted files` table (Task 1).

- [ ] **Step 1: Build the artifacts the test reads**

Run: `pnpm nx build ai-patterns`
Expected: `packages/ai-patterns/dist/artifacts/` exists. The test asserts on real built output, the way #145's audit did, rather than reasoning from the build script.

- [ ] **Step 2: Write the test**

```javascript
/* The brand boundary, enforced.
 *
 * docs/agents/brand-boundary.md states the rule: the system ships what is inert until
 * chosen or true under every brand, and the consumer holds anything an agent applies by
 * default with no dial to turn.
 *
 * A rule documented only in prose is a rule that drifts — which is how one consumer's
 * price format, wordmark punctuation and product line came to ship to every other
 * consumer as the design system's own guidance. Two things are asserted, both mechanical:
 *
 *   1. No published artifact contains a brand term outside a permitted file.
 *   2. The permitted-file set is exactly the set the doc's table names. Double-entry, so
 *      neither side can move without the other.
 *
 * Two terms are deliberately absent from the denylist, both recorded decisions:
 * "Miltinson Design System" is the system's own name, and `miltinson` is a palette and a
 * pack identifier. Matching is therefore term-plus-context, not bare substring.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..', '..');
const distArtifacts = join(here, '..', '..', 'dist', 'artifacts');

/* Business facts about one consumer. Not "Miltinson" alone: the system's name contains
   it, and so do the palette and pack identifiers, all three kept on purpose. */
const BRAND_TERMS = [
  'Eli Robinson',
  'miltinsons.com',
  'Kids Recipes',
  'Coaching Guides',
  'From $150/hr',
  'Miltinson Technologies',
  'Builder. Consultant. Founder.',
];

/* Permitted paths, read from the doc's table so the doc and the test cannot disagree.
 *
 * Sliced by index rather than matched with one regex on purpose: `## Permitted files` is
 * the document's last heading, and a `(?=\n## |\n*$)` terminator under the `m` flag ends
 * the section at the first newline — `$` is end-of-LINE there, so the capture comes back
 * empty and every file silently becomes permitted. A guard that permits everything is
 * worse than no guard, so the section is bounded by the next heading or the end of file. */
function permittedFiles() {
  const doc = readFileSync(join(repo, 'docs/agents/brand-boundary.md'), 'utf8');
  const start = doc.indexOf('## Permitted files');
  if (start === -1) throw new Error('brand-boundary.md has no "## Permitted files" section');

  const rest = doc.slice(start + 1);
  const next = rest.indexOf('\n## ');
  const body = next === -1 ? rest : rest.slice(0, next);

  const paths = body
    .split('\n')
    .map((line) => line.match(/^\|\s*`([^`]+)`\s*\|/))
    .filter(Boolean)
    .map((match) => match[1]);

  /* An empty table means the parser broke, not that nothing is permitted. Fail loudly:
     the silent-empty case is the one that turns this whole suite green and meaningless. */
  if (paths.length === 0) {
    throw new Error('brand-boundary.md\'s "## Permitted files" table parsed to zero rows');
  }

  return paths;
}

function filesUnder(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    if (/\.(png|jpg|jpeg|webp|woff2?|ico|svg)$/i.test(entry.name)) return [];
    return [path];
  });
}

describe('the brand boundary', () => {
  const permitted = permittedFiles();

  it('reads a non-empty permitted-file table from the doc', () => {
    expect(permitted.length).toBeGreaterThan(0);
  });

  it('permits only files that exist, so the table cannot rot', () => {
    for (const path of permitted) {
      expect(
        statSync(join(repo, path), { throwIfNoEntry: false }),
        `${path} is permitted but does not exist`,
      ).toBeDefined();
    }
  });

  describe('no published artifact asserts one consumer as a rule of the system', () => {
    const built = filesUnder(distArtifacts);

    it('found built artifacts to check — run `nx build ai-patterns` first', () => {
      expect(built.length).toBeGreaterThan(0);
    });

    /* Permitted source files reach the tarball under their basename, so a built file is
       permitted when its source counterpart is. */
    const permittedNames = new Set(permitted.map((path) => path.split('/').pop()));

    it.each(built.map((path) => ({ file: relative(distArtifacts, path), path })))(
      '$file',
      ({ file, path }) => {
        if (permittedNames.has(file.split('/').pop())) return;
        const source = readFileSync(path, 'utf8');
        expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
      },
    );
  });

  it('the ds init --agents templates carry no brand at all', () => {
    for (const path of filesUnder(join(here, '..', 'agents'))) {
      const source = readFileSync(path, 'utf8');
      expect(BRAND_TERMS.filter((term) => source.includes(term))).toEqual([]);
    }
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm --filter @elirobinson/ai-patterns exec vitest run brand-boundary`
Expected: PASS.

**If it fails, read the failure before changing anything.** A failing file is either (a) something PRs 1–4 should have moved and missed — fix the file, or (b) genuinely a pack or fixture — add it to the doc's table, never to the test. Widening `BRAND_TERMS`' carve-outs to get green defeats the point.

- [ ] **Step 4: Prove the test can fail**

A guard that has never failed is a guard nobody has tested.

```bash
echo "<!-- Eli Robinson -->" >> packages/ai-patterns/dist/artifacts/skills/design-system-reference/llms.txt
pnpm --filter @elirobinson/ai-patterns exec vitest run brand-boundary
```

Expected: FAIL, naming `llms.txt`. Then restore:

```bash
pnpm nx build ai-patterns
pnpm --filter @elirobinson/ai-patterns exec vitest run brand-boundary
```

Expected: PASS again.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-patterns/src/artifacts/brand-boundary.test.mjs
git commit -m "test(ai-patterns): no published artifact asserts one consumer as a rule of the system"
```

---

### Task 17: Record every answer on #145 and close it

- [ ] **Step 1: Changeset**

```markdown
---
'@elirobinson/ai-patterns': patch
---

The brand boundary is a test now, not an eye.

`docs/agents/brand-boundary.md` states which files may hold a brand's values, and
`brand-boundary.test.mjs` reads that table and checks every built artifact against it.
Double-entry: the doc and the test cannot disagree, and a new permitted file is a
deliberate edit to a table rather than a quiet addition to a denylist.

`product-token-layer.md` now says why a palette is not a product value — inert until
selected and measured by the contrast gate — so the two rules stop looking contradictory.
```

- [ ] **Step 2: Full verification, and the acceptance criteria checked one at a time**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Then verify each of #145's acceptance criteria against the result, rather than assuming the PRs covered them:

```bash
# no real contact details on the public brand site
grep -rn "eli@miltinsons" design-system-docs/ || echo "clear"
# no colour literal in the kits
grep -rn "oklch(" design-system-docs/ui_kits/ || echo "clear"
# the corpus no longer frames the voice as the system's rule
grep -n "these rules make it Miltinson" packages/ai-patterns/dist/artifacts/skills/design-system-reference/llms-full.txt || echo "clear"
```

- [ ] **Step 3: Post the recorded answers and close**

Post a comment on #145 answering all six open questions verbatim from the spec's "Recorded answers" section, plus the boundary rule as adopted, plus the two items named as unsettled. Close the issue only after that comment exists — the issue's own acceptance criteria require the answers to be recorded, including "later".

- [ ] **Step 4: Open PR 5**

```bash
git add -A && git commit -m "chore(changeset): the brand boundary test"
git push -u origin claude/brand-boundary-test
gh pr create --title "test(ai-patterns): the brand boundary, enforced" --fill
gh pr view --json mergeable,mergeStateStatus
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: the boundary rule → Task 1; the two do-regardless fixes → Tasks 2–3; the pack shape and schema → Tasks 5–6; the `guideline-cards` reversal → Task 15; discovery → Tasks 10–11; the data-flow's three generated surfaces → Task 8; the docs voice page's re-pointed link → Task 9; error handling (fallback, malformed, missing section, unknown fields) → Tasks 5 and 10; the six recorded answers → Task 17; #159's absorption → Task 13 Step 3; the unsettled avoid-list question → Tasks 1 and 5.

**One thing deliberately deferred.** The spec's `Touches` list names `packages/ai-patterns/package.json`'s exports map. `./brand-readme` still points at the built README, which remains a legitimate export now that the README is no longer the voice's source of truth — the pack is. Removing it is a breaking change with no benefit once Task 12 relabels what the corpus says about it, so it stays. If a later decision removes it, that is a major bump of its own.

**Known ordering hazard.** Task 8 depends on Task 7's named blocks and Task 6's byte-identity fixture. If Task 6's fixture is regenerated after Task 8 has run the sync, it will capture generated output and the byte test becomes a tautology. Regenerate the fixture only from a commit before Task 8.
