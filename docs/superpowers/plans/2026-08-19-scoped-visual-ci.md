# Scoped Visual CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the visual suite on pull requests to the code that changed, move the full sweep to `main` and a nightly schedule, and give both a mechanical path back to green when they fail.

**Architecture:** Four small Node modules in `scripts/` do all the thinking and are unit-tested with vitest; `visual.yml` becomes two jobs that call them. Selection is two-layer — `nx show projects --affected` decides whether `docs` and `storybook` run at all, then changed-file patterns narrow to individual stories and routes, with a fan-out rule that forces all docs shots whenever the component registry gains or loses an entry. Playwright's own `--list --reporter=json` is the only enumerator, so nothing can drift from what the suite actually runs.

**Tech Stack:** Node 24 ESM (`.mjs`), vitest, Nx 22.7.0, Playwright 1.62, GitHub Actions, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-08-19-scoped-visual-ci-design.md`

## Global Constraints

These apply to every task. Copied verbatim from the spec and from the repository's existing rules.

- **Never add workers.** Every Playwright invocation uses `--workers=1`. Issue #65 measured serial → 3 workers taking a run from 1 failure to 18.
- **Never relax the comparison.** Do not touch `threshold`, `maxDiffPixels`, or `expect.timeout` in `packages/ai-patterns/src/testing/visual-config.mjs`.
- **Baselines are only written inside the pinned container**, with `DS_VISUAL_CONTAINER=1` set. Never set that variable in a job whose purpose is comparison.
- **Playwright `--grep` matches the full title path**, which begins with the spec file path. A `^` anchor matches nothing. Verified: `--grep "^/components/button · "` returns 0 tests; the same pattern without `^` returns 2.
- **Story patterns end in `--`**; route patterns end in `·` (space, middle dot U+00B7, space). These are the anchors.
- **Baseline path template** is `{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}` from `SNAPSHOT_PATH_TEMPLATE` in `visual-config.mjs`, with `testDir` = `tests/visual`.
- **Project → spec file path** is fixed: `storybook-wide` and `storybook-narrow` → `storybook/storybook.spec.ts`; `docs-wide` and `docs-narrow` → `docs/docs.spec.ts`; `smoke` takes no baselines.
- **Commit style:** lower-case scoped conventional commits, e.g. `test(visual): …`, `ci(visual): …`. End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **No barrel files.** Import via package subpaths.
- Expected counts on `main` at the time of writing: 501 listed tests = 9 smoke + 168 `storybook-wide` + 168 `storybook-narrow` + 142 `docs-wide` + 14 `docs-narrow`; 492 baseline PNGs on disk.

---

## File Structure

| File                               | Responsibility                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `scripts/package.json`             | Makes `scripts/` a private workspace package so its tests run under `pnpm test`.                                              |
| `scripts/project.json`             | Nx project definition with a `test` target.                                                                                   |
| `scripts/vitest.config.ts`         | vitest config, matching the other packages' shape.                                                                            |
| `scripts/visual-shots.mjs`         | Enumerates every shot the suite will take, and where its baseline lives. The single source of truth the other three build on. |
| `scripts/visual-missing.mjs`       | Shots whose baseline does not exist → a grep pattern.                                                                         |
| `scripts/visual-scope.mjs`         | Changed files → the grep pattern for the shots that could have changed.                                                       |
| `scripts/visual-failures.mjs`      | A Playwright JSON report → the grep pattern for the shots that failed.                                                        |
| `.github/workflows/visual.yml`     | Rewritten: a scoped `pull_request` job and a full `main`/nightly job.                                                         |
| `playwright.config.ts`             | Adds a `json` reporter so failures are machine-readable.                                                                      |
| `docs/agents/visual-regression.md` | New section on the topology, the label, and the fan-out fact.                                                                 |

---

## Task 1: Make `scripts/` a tested workspace project

`scripts/` currently has no `package.json`, no `project.json` and no vitest config, so nothing in it is reachable by `pnpm test` (`nx run-many -t test`). Every other project in the repo has all three. This task adds them so Tasks 2–5 have somewhere to put tests.

**Files:**

- Create: `scripts/package.json`
- Create: `scripts/project.json`
- Create: `scripts/vitest.config.ts`
- Modify: `pnpm-workspace.yaml`
- Test: `scripts/visual-shots.test.mjs` (a placeholder assertion, replaced in Task 2)

**Interfaces:**

- Consumes: nothing.
- Produces: a project named `scripts` with a working `test` target, runnable as `pnpm exec nx test scripts` and included in `pnpm test`.

- [ ] **Step 1: Add `scripts` to the workspace**

Modify `pnpm-workspace.yaml`. The `packages:` list currently reads:

```yaml
packages:
  - './packages/*'
  - './apps/*'
```

Change it to:

```yaml
packages:
  - './packages/*'
  - './apps/*'
  # Repo-local CI tooling. Private and never published — it encodes this
  # repository's own paths, which is exactly what must not reach a consumer.
  # It is a workspace package solely so `pnpm test` reaches its tests.
  - './scripts'
```

- [ ] **Step 2: Create `scripts/package.json`**

```json
{
  "name": "@elirobinson/visual-ci",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^4.0.18"
  }
}
```

Check the version of vitest the other packages use and match it exactly:

```bash
grep '"vitest"' packages/*/package.json apps/*/package.json
```

Use whatever version that command reports, not the placeholder above.

- [ ] **Step 3: Create `scripts/vitest.config.ts`**

Mirrors `packages/tokens/vitest.config.ts`, except the tests sit at the package root rather than under `src/`.

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['*.test.mjs'],
  },
});
```

- [ ] **Step 4: Create `scripts/project.json`**

Mirrors `packages/ai-patterns/project.json`.

```json
{
  "name": "scripts",
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "scripts",
  "projectType": "library",
  "targets": {
    "test": {
      "command": "pnpm run test",
      "options": {
        "cwd": "scripts"
      }
    }
  }
}
```

- [ ] **Step 5: Write a placeholder test so the target has something to run**

Create `scripts/visual-shots.test.mjs`:

```js
import { describe, expect, it } from 'vitest';

describe('scripts project wiring', () => {
  it('runs under vitest', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 6: Install and verify the project is wired up**

```bash
pnpm install
pnpm exec nx test scripts
```

Expected: vitest runs and reports 1 passing test.

- [ ] **Step 7: Verify `pnpm test` now includes it**

```bash
pnpm exec nx show projects
```

Expected: the list includes `scripts` alongside the existing eight projects.

- [ ] **Step 8: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml scripts/package.json scripts/project.json scripts/vitest.config.ts scripts/visual-shots.test.mjs
git commit -m "$(cat <<'EOF'
build(scripts): make scripts a private workspace project with tests

Nothing in scripts/ was reachable by `pnpm test`, so the CI tooling added
next would have shipped untested. Private and never published: it encodes
this repository's own paths.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `scripts/visual-shots.mjs` — enumerate every shot and its baseline

Everything downstream needs the same answer to "what shots exist, and where does each baseline live?". Deriving it from `playwright test --list --reporter=json` means Playwright's own collection is the enumerator, so this cannot disagree with the suite about which tests exist. The only thing encoded here is the title→filename mapping, which mirrors the `name` callbacks in `visual-sweep.mjs`.

**Files:**

- Create: `scripts/visual-shots.mjs`
- Test: `scripts/visual-shots.test.mjs` (replaces the placeholder)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `parseShots(listJson: object): Shot[]` where `Shot = { project: string, title: string, route: string|null, storyId: string|null, theme: 'light'|'dark', baselinePath: string }`
  - `listShots(options?: { cwd?: string }): Shot[]` — shells out to Playwright and calls `parseShots`
  - `SPEC_FILE_BY_PROJECT: Record<string, string>`

- [ ] **Step 1: Write the failing test**

Replace the whole contents of `scripts/visual-shots.test.mjs`:

```js
// Playwright's own collection is the enumerator here, so these tests feed it a
// recorded `--list --reporter=json` payload rather than re-describing the
// suite. What is actually under test is the title-to-baseline mapping, which
// mirrors the `name` callbacks in visual-sweep.mjs and is the one thing that
// could drift without anything reporting it.

import { describe, expect, it } from 'vitest';

import { SPEC_FILE_BY_PROJECT, parseShots } from './visual-shots.mjs';

/* The shape Playwright emits: top-level suites carry `specs`, each spec has
   `tests` carrying `projectName`. Nested suites are possible, so parseShots
   must recurse. */
const listJson = {
  suites: [
    {
      title: 'config.smoke.spec.ts',
      file: 'config.smoke.spec.ts',
      specs: [
        { title: 'refuses to update outside the container', tests: [{ projectName: 'smoke' }] },
      ],
    },
    {
      title: 'storybook/storybook.spec.ts',
      file: '../../packages/ai-patterns/src/testing/visual-sweep.mjs',
      specs: [
        {
          title: 'components-button--primary · light',
          tests: [{ projectName: 'storybook-wide' }, { projectName: 'storybook-narrow' }],
        },
        { title: '/ · dark', tests: [{ projectName: 'docs-wide' }] },
        { title: '/patterns/forms · light @responsive', tests: [{ projectName: 'docs-narrow' }] },
        { title: '/components/date-picker · dark', tests: [{ projectName: 'docs-wide' }] },
      ],
    },
  ],
};

describe('parseShots', () => {
  const shots = parseShots(listJson);

  it('drops the smoke project, which takes no baselines', () => {
    expect(shots.some((shot) => shot.project === 'smoke')).toBe(false);
  });

  it('emits one shot per project per spec', () => {
    expect(shots).toHaveLength(5);
  });

  it('maps a story title to its baseline path', () => {
    const shot = shots.find((s) => s.project === 'storybook-wide');
    expect(shot.storyId).toBe('components-button--primary');
    expect(shot.route).toBeNull();
    expect(shot.theme).toBe('light');
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/storybook-wide/storybook/storybook.spec.ts/components-button--primary-light.png',
    );
  });

  it('maps the root route to the index slug', () => {
    const shot = shots.find((s) => s.title === '/ · dark');
    expect(shot.route).toBe('/');
    expect(shot.storyId).toBeNull();
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/docs-wide/docs/docs.spec.ts/index-dark.png',
    );
  });

  it('strips the @responsive tag before reading the theme', () => {
    const shot = shots.find((s) => s.project === 'docs-narrow');
    expect(shot.route).toBe('/patterns/forms');
    expect(shot.theme).toBe('light');
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/docs-narrow/docs/docs.spec.ts/patterns-forms-light.png',
    );
  });

  it('flattens nested route segments into the slug with dashes', () => {
    const shot = shots.find((s) => s.title === '/components/date-picker · dark');
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/docs-wide/docs/docs.spec.ts/components-date-picker-dark.png',
    );
  });

  it('refuses a project it has no spec file for, rather than guessing', () => {
    const rogue = {
      suites: [{ specs: [{ title: 'x · light', tests: [{ projectName: 'tablet' }] }] }],
    };
    expect(() => parseShots(rogue)).toThrow(/tablet/);
  });

  it('knows the four baseline-taking projects', () => {
    expect(Object.keys(SPEC_FILE_BY_PROJECT).sort()).toEqual([
      'docs-narrow',
      'docs-wide',
      'storybook-narrow',
      'storybook-wide',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm exec nx test scripts
```

Expected: FAIL — `Failed to resolve import "./visual-shots.mjs"`.

- [ ] **Step 3: Write the implementation**

Create `scripts/visual-shots.mjs`:

```js
/* Every shot the suite will take, and where its baseline lives.
 *
 * The enumeration is Playwright's own — `--list --reporter=json` — rather than
 * a second walk of the manifests. A second enumerator that could disagree with
 * the first is how a shot stops being covered without anyone noticing, which is
 * the failure `visual-sweep.test.mjs` was written to prevent one layer down.
 *
 * What is encoded here is only the mapping from a test title to a baseline
 * path. That mirrors the `name` callbacks in visual-sweep.mjs and the
 * SNAPSHOT_PATH_TEMPLATE in visual-config.mjs, and Task 2's disk cross-check
 * asserts the two still agree. */

import { execFileSync } from 'node:child_process';

/* `{testFilePath}` in the snapshot template resolves to the spec that owns the
   test, but both sweeps register their tests from inside visual-sweep.mjs, so
   the JSON listing attributes them to that file instead. The project name is
   what actually distinguishes them, and the mapping is fixed by
   playwright.config.ts. `smoke` is absent deliberately: it takes no baselines. */
export const SPEC_FILE_BY_PROJECT = {
  'storybook-wide': 'storybook/storybook.spec.ts',
  'storybook-narrow': 'storybook/storybook.spec.ts',
  'docs-wide': 'docs/docs.spec.ts',
  'docs-narrow': 'docs/docs.spec.ts',
};

const TEST_DIR = 'tests/visual';
const TITLE_SEPARATOR = ' · ';

/** `/patterns/forms` → `patterns-forms`; `/` → `index`. Mirrors `routeSlug`. */
function routeSlug(route) {
  return route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '-');
}

/** Every spec in a Playwright `--list --reporter=json` payload, flattened. */
function collectSpecs(node, out = []) {
  for (const spec of node.specs ?? []) {
    out.push(spec);
  }
  for (const suite of node.suites ?? []) {
    collectSpecs(suite, out);
  }
  return out;
}

/**
 * Shots from a `playwright test --list --reporter=json` payload.
 *
 * Throws on a project with no known spec file rather than skipping it. A new
 * viewport project added to playwright.config.ts and not added here would
 * otherwise vanish from every scoping decision silently.
 */
export function parseShots(listJson) {
  const shots = [];

  for (const spec of collectSpecs(listJson)) {
    for (const test of spec.tests ?? []) {
      const project = test.projectName;

      /* Takes no baselines, so it has nothing to select or regenerate. */
      if (project === 'smoke') {
        continue;
      }

      const specFile = SPEC_FILE_BY_PROJECT[project];
      if (!specFile) {
        throw new Error(
          `visual-shots: no spec file known for project '${project}'. ` +
            'Add it to SPEC_FILE_BY_PROJECT — a project this cannot place is a ' +
            'project that silently drops out of every scoping decision.',
        );
      }

      const [subject, rest] = splitTitle(spec.title, project);
      const theme = rest.split(' ')[0];
      const isRoute = subject.startsWith('/');
      const arg = isRoute ? routeSlug(subject) : subject;

      shots.push({
        project,
        title: spec.title,
        route: isRoute ? subject : null,
        storyId: isRoute ? null : subject,
        theme,
        baselinePath: `${TEST_DIR}/__screenshots__/${project}/${specFile}/${arg}-${theme}.png`,
      });
    }
  }

  return shots;
}

/* Titles are `<subject> · <theme>` with an optional ` @responsive` tag after
   the theme. Splitting on the separator rather than the last space keeps a
   subject containing a space from being misread. */
function splitTitle(title, project) {
  const at = title.indexOf(TITLE_SEPARATOR);
  if (at === -1) {
    throw new Error(
      `visual-shots: title '${title}' (project '${project}') has no ' · ' separator, ` +
        'so its theme cannot be read. The sweeps build every title this way.',
    );
  }
  return [title.slice(0, at), title.slice(at + TITLE_SEPARATOR.length)];
}

/** Runs Playwright's collection and parses it. Needs both apps built. */
export function listShots({ cwd = process.cwd() } = {}) {
  const stdout = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return parseShots(JSON.parse(stdout));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm exec nx test scripts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Add the cross-check against real baselines on disk**

This is the assertion that catches drift between this mapping and Playwright's actual behaviour. It needs both apps built, so it skips itself when they are not — a developer running `pnpm test` on a bare checkout should not get a failure they cannot act on, but CI (where `pretest:visual` has run) gets the check.

Append to `scripts/visual-shots.test.mjs`:

```js
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { listShots } from './visual-shots.mjs';

/* The mapping above is asserted against fixtures, which proves it is
   self-consistent and not that it matches Playwright. This does: every baseline
   on disk must be a path this module computes, and vice versa. If Playwright
   changes how it resolves {testFilePath}, or a viewport project is added to the
   config and not to SPEC_FILE_BY_PROJECT, this is what reports it. */
const BUILDS_PRESENT =
  existsSync('../apps/storybook/storybook-static/index.json') &&
  existsSync('../apps/docs/.next/prerender-manifest.json');

describe.skipIf(!BUILDS_PRESENT)('computed baseline paths vs the ones on disk', () => {
  it('agree exactly, in both directions', () => {
    const computed = new Set(listShots({ cwd: '..' }).map((shot) => shot.baselinePath));

    const root = '../tests/visual/__screenshots__';
    const onDisk = new Set();
    for (const project of readdirSync(root)) {
      for (const specDir of readdirSync(join(root, project))) {
        for (const specFile of readdirSync(join(root, project, specDir))) {
          for (const png of readdirSync(join(root, project, specDir, specFile))) {
            onDisk.add(`tests/visual/__screenshots__/${project}/${specDir}/${specFile}/${png}`);
          }
        }
      }
    }

    /* Sorted arrays rather than set equality: on a failure the diff names the
       paths, which is the whole value of running this. */
    expect([...computed].sort()).toEqual([...onDisk].sort());
  });
});
```

- [ ] **Step 6: Build both apps, then run the test**

```bash
pnpm run pretest:visual
pnpm exec nx test scripts
```

Expected: PASS, 9 tests. The cross-check compares 492 computed paths against 492 files.

If it fails with a small symmetric difference, the title→filename mapping is wrong — fix `parseShots`, not the test. If it fails because `onDisk` has entries `computed` lacks, a baseline is orphaned and should be reported to the user rather than deleted.

- [ ] **Step 7: Commit**

```bash
git add scripts/visual-shots.mjs scripts/visual-shots.test.mjs
git commit -m "$(cat <<'EOF'
test(visual): enumerate shots from playwright's own collection

Everything downstream needs one answer to "what shots exist and where does
each baseline live". Taking it from --list --reporter=json means this cannot
disagree with the suite about which tests exist; only the title-to-filename
mapping is encoded here, and the disk cross-check asserts that against all
492 baselines whenever the builds are present.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `scripts/visual-missing.mjs` — shots with no baseline

**Files:**

- Create: `scripts/visual-missing.mjs`
- Test: `scripts/visual-missing.test.mjs`

**Interfaces:**

- Consumes: `Shot` from `./visual-shots.mjs` (Task 2).
- Produces:
  - `missingShots(shots: Shot[], exists: (path: string) => boolean): Shot[]`
  - `grepFor(shots: Shot[]): string | null` — an alternation of escaped, anchored patterns, or `null` for an empty list
  - CLI: `node scripts/visual-missing.mjs` prints the grep pattern to stdout, or nothing when none are missing

- [ ] **Step 1: Write the failing test**

Create `scripts/visual-missing.test.mjs`:

```js
import { describe, expect, it } from 'vitest';

import { grepFor, missingShots } from './visual-missing.mjs';

const shot = (over) => ({
  project: 'storybook-wide',
  title: 'components-button--primary · light',
  route: null,
  storyId: 'components-button--primary',
  theme: 'light',
  baselinePath: 'tests/visual/__screenshots__/a.png',
  ...over,
});

describe('missingShots', () => {
  it('returns only the shots whose baseline is absent', () => {
    const shots = [
      shot({ baselinePath: 'here.png' }),
      shot({ baselinePath: 'gone.png', storyId: 'components-badge--default' }),
    ];
    const missing = missingShots(shots, (path) => path === 'here.png');
    expect(missing).toHaveLength(1);
    expect(missing[0].storyId).toBe('components-badge--default');
  });

  it('returns an empty array when every baseline exists', () => {
    expect(missingShots([shot({})], () => true)).toEqual([]);
  });
});

describe('grepFor', () => {
  it('is null for an empty list, so a caller cannot build a match-everything pattern', () => {
    expect(grepFor([])).toBeNull();
  });

  it('anchors a story on its trailing double dash', () => {
    expect(grepFor([shot({})])).toBe('components-button--primary · light');
  });

  it('escapes regex metacharacters in a title', () => {
    const pattern = grepFor([shot({ title: 'components-input--a.b · light' })]);
    expect(pattern).toBe('components-input--a\\.b · light');
    expect(new RegExp(pattern).test('components-input--a.b · light')).toBe(true);
    expect(new RegExp(pattern).test('components-input--axb · light')).toBe(false);
  });

  it('never emits a ^ anchor, which playwright matches against the file path', () => {
    expect(
      grepFor([shot({ title: '/components/button · dark', route: '/components/button' })]),
    ).not.toMatch(/\^/);
  });

  it('joins many shots with alternation and de-duplicates', () => {
    const pattern = grepFor([shot({}), shot({}), shot({ title: '/ · dark' })]);
    expect(pattern).toBe('components-button--primary · light|/ · dark');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm exec nx test scripts
```

Expected: FAIL — cannot resolve `./visual-missing.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/visual-missing.mjs`:

```js
/* Shots the suite will take that have no baseline yet.
 *
 * These are not regressions and never were. Before this existed, adding a
 * component produced one "failure" per new shot — 68 of them on PR #88 — and
 * the only remedy was a manual Visual update dispatch. The PR job now mints
 * them in the same run.
 *
 * Only ever *missing* baselines: this cannot overwrite one that exists, which
 * is what keeps it from laundering a real regression into an accepted
 * baseline. Overwriting is the opt-in `visual-accept` path, deliberately
 * separate. */

import { existsSync } from 'node:fs';

import { listShots } from './visual-shots.mjs';

/** The shots among `shots` whose baseline does not exist. */
export function missingShots(shots, exists = existsSync) {
  return shots.filter((shot) => !exists(shot.baselinePath));
}

/**
 * A Playwright `--grep` pattern selecting exactly `shots`, or null for none.
 *
 * Null rather than an empty string, because `--grep ''` matches every test —
 * an empty selection must be impossible to turn into a full sweep by accident.
 *
 * Whole titles rather than prefixes: the caller already knows precisely which
 * shots it wants, so there is nothing to widen to. No `^` anchor — Playwright
 * matches --grep against the full title path, which starts with the spec file,
 * so a leading ^ matches nothing at all.
 */
export function grepFor(shots) {
  if (shots.length === 0) {
    return null;
  }

  const seen = new Set();
  for (const shot of shots) {
    seen.add(escapeRegExp(shot.title));
  }

  return [...seen].join('|');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* CLI: prints the pattern, or nothing at all when no baseline is missing, so a
   workflow step can test the output for emptiness. */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const pattern = grepFor(missingShots(listShots()));
  if (pattern) {
    process.stdout.write(pattern);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm exec nx test scripts
```

Expected: PASS, 7 new tests.

- [ ] **Step 5: Verify the CLI reports nothing on a clean checkout**

Both apps are already built from Task 2.

```bash
node scripts/visual-missing.mjs; echo "[exit $?]"
```

Expected: no output before `[exit 0]` — every baseline on `main` exists.

- [ ] **Step 6: Commit**

```bash
git add scripts/visual-missing.mjs scripts/visual-missing.test.mjs
git commit -m "$(cat <<'EOF'
test(visual): detect shots that have no baseline yet

A new component's shots are not failures, but the suite had no way to say
so — 68 of PR #88's 210 reds were this. Only ever missing baselines: this
cannot overwrite an existing one, which is what stops it laundering a
regression into an accepted baseline.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `scripts/visual-scope.mjs` — changed files to a selection

The core of the change. Read the spec's "Component 1" section before starting; the sidebar fan-out rule in particular is not a heuristic and must not be softened.

**Files:**

- Create: `scripts/visual-scope.mjs`
- Test: `scripts/visual-scope.test.mjs`

**Interfaces:**

- Consumes: `Shot` from `./visual-shots.mjs` (Task 2); `grepFor` is **not** reused — this module builds prefix patterns, not whole-title patterns.
- Produces:
  - `scopeFor({ changes, affectedProjects, shots }): Plan` where `Plan = { run: boolean, grep: string|null, reason: string }` and `changes` is an array of `{ status: 'A'|'M'|'D', path: string }`
  - `parseNameStatus(raw: string): Change[]`
  - CLI: `node scripts/visual-scope.mjs --base <sha>` prints JSON `{ run, grep, reason }`

- [ ] **Step 1: Write the failing test**

Create `scripts/visual-scope.test.mjs`:

```js
// The dangerous direction for this module is quiet: a scope that is too narrow
// produces a green pull request and stale baselines on main, and nothing
// reports it. So the assertions that matter most here are the ones proving it
// widens when it must — above all the sidebar fan-out, which is why PR #88's
// 142 docs pages legitimately changed.

import { describe, expect, it } from 'vitest';

import { parseNameStatus, scopeFor } from './visual-scope.mjs';

const shots = [
  { project: 'storybook-wide', storyId: 'components-button--primary', route: null },
  { project: 'storybook-wide', storyId: 'components-badge--default', route: null },
  { project: 'docs-wide', storyId: null, route: '/components/button' },
  { project: 'docs-wide', storyId: null, route: '/components/badge' },
  { project: 'docs-wide', storyId: null, route: '/patterns/forms' },
];

const BOTH = ['docs', 'storybook', 'react'];

const plan = (changes, affectedProjects = BOTH) => scopeFor({ changes, affectedProjects, shots });

describe('layer 1: nx decides whether anything runs', () => {
  it('skips entirely when neither docs nor storybook is affected', () => {
    const result = plan(
      [{ status: 'M', path: 'packages/eslint-config/src/index.js' }],
      ['eslint-config'],
    );
    expect(result.run).toBe(false);
    expect(result.grep).toBeNull();
    expect(result.reason).toMatch(/neither/i);
  });

  it('skips when only the scripts project is affected', () => {
    const result = plan([{ status: 'M', path: 'scripts/visual-scope.mjs' }], ['scripts']);
    expect(result.run).toBe(false);
  });
});

describe('layer 1a: the sidebar fan-out', () => {
  it('runs every docs shot when a component file is ADDED', () => {
    const result = plan([
      { status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' },
    ]);
    expect(result.run).toBe(true);
    expect(result.reason).toMatch(/sidebar/i);
    /* Every docs route present, because the manifest-derived sidebar is on all
       of them. This is the PR #88 regression test. */
    expect(result.grep).toContain('/components/button · ');
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('runs every docs shot when a component file is DELETED', () => {
    const result = plan([{ status: 'D', path: 'packages/react/src/components/atoms/Badge.tsx' }]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('does NOT fan out when a component file is merely MODIFIED', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }]);
    expect(result.grep).toContain('/components/button · ');
    expect(result.grep).not.toContain('/patterns/forms · ');
    expect(result.grep).not.toContain('/components/badge · ');
  });

  it('fans out when a docs page is added', () => {
    const result = plan([
      { status: 'A', path: 'apps/docs/src/app/(docs)/foundations/motion/page.mdx' },
    ]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('fans out on a change to the site map', () => {
    const result = plan([{ status: 'M', path: 'apps/docs/src/lib/site-map.ts' }]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('fans out on a change to the site chrome', () => {
    const result = plan([{ status: 'M', path: 'apps/docs/src/app/(docs)/layout.tsx' }]);
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('fans out the docs side only, leaving storybook narrowed', () => {
    const result = plan([
      { status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' },
    ]);
    expect(result.grep).not.toContain('components-badge--');
  });
});

describe('layer 2: narrowing', () => {
  it('maps a component file to its stories and its docs page', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }]);
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('/components/button · ');
  });

  it('maps a multi-word component to both of its naming forms', () => {
    const withPicker = [
      ...shots,
      { project: 'storybook-wide', storyId: 'components-datepicker--default', route: null },
      { project: 'docs-wide', storyId: null, route: '/components/date-picker' },
    ];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'packages/react/src/components/molecules/DatePicker.tsx' }],
      affectedProjects: BOTH,
      shots: withPicker,
    });
    expect(result.grep).toContain('components-datepicker--');
    expect(result.grep).toContain('/components/date-picker · ');
  });

  it('maps a story file to its stories', () => {
    const result = plan([{ status: 'M', path: 'apps/storybook/src/stories/Badge.stories.tsx' }]);
    expect(result.grep).toContain('components-badge--');
  });

  it('maps a docs page to its own route', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/patterns/forms/page.mdx' },
    ]);
    expect(result.grep).toBe('/patterns/forms · ');
  });

  it('maps a demo directory to the component page that embeds it', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/components/demos/badge/Variants.tsx' },
    ]);
    expect(result.grep).toBe('/components/badge · ');
  });
});

describe('the unnarrowable fallback is the project, never the world', () => {
  it('runs all storybook shots for a storybook config change, and no docs shots', () => {
    const result = scopeFor({
      changes: [{ status: 'M', path: 'apps/storybook/.storybook/preview.ts' }],
      affectedProjects: ['storybook'],
      shots,
    });
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('components-badge--');
    expect(result.grep).not.toContain('/components/button · ');
  });

  it('runs everything for a token change, because a token change affects everything', () => {
    const result = plan([{ status: 'M', path: 'packages/tokens/src/index.ts' }]);
    expect(result.grep).toContain('components-button--');
    expect(result.grep).toContain('/patterns/forms · ');
  });

  it('runs all shots of an affected project for a change under src/lib', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/lib/cx.ts' }]);
    expect(result.grep).toContain('components-badge--');
  });
});

describe('pattern anchoring', () => {
  it('anchors a story pattern on the trailing double dash', () => {
    const withTrap = [
      ...shots,
      {
        project: 'storybook-wide',
        storyId: 'components-dropdownmenu--with-button-trigger',
        route: null,
      },
    ];
    const result = scopeFor({
      changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
      affectedProjects: BOTH,
      shots: withTrap,
    });
    const re = new RegExp(result.grep);
    expect(re.test('components-button--primary · light')).toBe(true);
    expect(re.test('components-dropdownmenu--with-button-trigger · light')).toBe(false);
  });

  it('anchors a route pattern on the trailing separator', () => {
    const result = plan([
      { status: 'M', path: 'apps/docs/src/app/(docs)/components/badge/page.mdx' },
    ]);
    const re = new RegExp(result.grep);
    expect(re.test('/components/badge · light')).toBe(true);
    expect(re.test('/components/badge-group · light')).toBe(false);
  });

  it('never emits a ^ anchor', () => {
    const result = plan([{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }]);
    expect(result.grep).not.toMatch(/\^/);
  });
});

describe('the guard fails loudly rather than narrowing quietly', () => {
  it('throws when a component maps to no shot at all', () => {
    expect(() =>
      plan([{ status: 'M', path: 'packages/react/src/components/atoms/Ghost.tsx' }]),
    ).toThrow(/Ghost/);
  });

  it('throws when a docs page maps to no route', () => {
    expect(() =>
      plan([{ status: 'M', path: 'apps/docs/src/app/(docs)/nowhere/page.mdx' }]),
    ).toThrow(/nowhere/);
  });
});

describe('parseNameStatus', () => {
  it('reads git diff --name-status output', () => {
    const raw =
      'A\tpackages/react/src/components/atoms/VerdictBadge.tsx\nM\tapps/docs/src/lib/site-map.ts\nD\tapps/storybook/src/stories/Old.stories.tsx\n';
    expect(parseNameStatus(raw)).toEqual([
      { status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' },
      { status: 'M', path: 'apps/docs/src/lib/site-map.ts' },
      { status: 'D', path: 'apps/storybook/src/stories/Old.stories.tsx' },
    ]);
  });

  it('reads a rename as a delete plus an add, so the fan-out rule sees it', () => {
    const raw =
      'R100\tpackages/react/src/components/atoms/Old.tsx\tpackages/react/src/components/atoms/New.tsx\n';
    expect(parseNameStatus(raw)).toEqual([
      { status: 'D', path: 'packages/react/src/components/atoms/Old.tsx' },
      { status: 'A', path: 'packages/react/src/components/atoms/New.tsx' },
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseNameStatus('\n\n')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm exec nx test scripts
```

Expected: FAIL — cannot resolve `./visual-scope.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/visual-scope.mjs`:

```js
/* Which shots a change could possibly have altered.
 *
 * Two layers, because neither alone is enough. Nx knows the import graph and
 * answers "is docs affected? is storybook affected?" authoritatively, but its
 * granularity is the project: any file under packages/react marks both
 * consumers affected, so it cannot tell Button from the whole library. The
 * file patterns below do that part, and they know nothing about imports.
 *
 * The dangerous failure here is the quiet one. A scope that is too wide costs
 * minutes; a scope that is too narrow produces a green pull request and stale
 * baselines on main, and nothing reports it. Every judgement call in this file
 * is therefore resolved by widening, and the two cases that cannot be resolved
 * at all throw. */

import { execFileSync } from 'node:child_process';

import { listShots } from './visual-shots.mjs';

const DOCS_PROJECT = 'docs';
const STORYBOOK_PROJECT = 'storybook';

const COMPONENT_FILE = /^packages\/react\/src\/components\/[^/]+\/([A-Z][A-Za-z0-9]*)\.(tsx|css)$/;
const STORY_FILE = /^apps\/storybook\/src\/stories\/([A-Z][A-Za-z0-9]*)\.stories\.tsx$/;
const DOCS_PAGE = /^apps\/docs\/src\/app\/\(docs\)\/(.+)\/page\.(mdx|tsx)$/;
const DEMO_FILE = /^apps\/docs\/src\/components\/demos\/([^/]+)\//;

/* A change to the *set* of things in the registry changes every docs page,
   because site-map.ts derives the sidebar from the component manifest and the
   sidebar is rendered on all of them. Measured, not assumed: PR #88 added six
   components and every one of the 142 pre-existing docs shots failed
   comparison, with zero story failures. */
const SIDEBAR_SOURCES = [
  'apps/docs/src/lib/site-map.ts',
  'apps/docs/src/lib/manifest.ts',
  'apps/docs/src/app/(docs)/layout.tsx',
  'apps/docs/src/components/docs/SiteHeader.tsx',
  'apps/docs/src/styles/site.css',
];

/** `git diff --name-status` output → changes, with renames split in two. */
export function parseNameStatus(raw) {
  const changes = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) {
      continue;
    }

    const [status, ...paths] = line.split('\t');

    /* A rename is a delete and an add as far as the sidebar is concerned — the
       registry loses one entry and gains another — so it must not be collapsed
       into a modify. */
    if (status.startsWith('R') || status.startsWith('C')) {
      changes.push({ status: 'D', path: paths[0] });
      changes.push({ status: 'A', path: paths[1] });
      continue;
    }

    changes.push({ status: status[0], path: paths[0] });
  }

  return changes;
}

/** `DatePicker` → `components-datepicker--`, the storybook id prefix. */
function storyPrefix(name) {
  return `components-${name.toLowerCase()}--`;
}

/** `DatePicker` → `date-picker`, the docs route slug. */
function docsSlug(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/* The trailing ' · ' is the anchor: without it '/components/card' would also
   select '/components/card-group'. Titles are built as `<route> · <theme>`. */
function routePattern(route) {
  return `${route} · `;
}

export function scopeFor({ changes, affectedProjects, shots }) {
  const affected = new Set(affectedProjects);
  const docsAffected = affected.has(DOCS_PROJECT);
  const storybookAffected = affected.has(STORYBOOK_PROJECT);

  if (!docsAffected && !storybookAffected) {
    return {
      run: false,
      grep: null,
      reason: 'nx reports neither docs nor storybook affected, so no shot can have changed',
    };
  }

  const allRoutes = [...new Set(shots.filter((s) => s.route).map((s) => s.route))];
  const allStoryIds = [...new Set(shots.filter((s) => s.storyId).map((s) => s.storyId))];

  const patterns = new Set();
  const reasons = [];

  /* Layer 1a, before any narrowing: a registry change fans out to every docs
     page, so there is nothing left to narrow on that side. */
  const fanOut = changes.some(
    (change) =>
      SIDEBAR_SOURCES.includes(change.path) ||
      (change.status !== 'M' && COMPONENT_FILE.test(change.path)) ||
      (change.status !== 'M' && DOCS_PAGE.test(change.path)),
  );

  let docsNarrowable = docsAffected && !fanOut;

  if (docsAffected && fanOut) {
    for (const route of allRoutes) {
      patterns.add(routePattern(route));
    }
    reasons.push(
      'the component or page registry changed, and the sidebar derived from it is on every docs page',
    );
  }

  let storybookNarrowable = storybookAffected;

  for (const change of changes) {
    const component = COMPONENT_FILE.exec(change.path);
    if (component) {
      /* The narrowable flags are read from the enclosing scope rather than
         passed: they are reassigned by the fallback branches below, and a
         copy taken at call time would go stale mid-loop. */
      addComponent({ name: component[1], patterns, allStoryIds, allRoutes });
      continue;
    }

    const story = STORY_FILE.exec(change.path);
    if (story && storybookNarrowable) {
      addStories({ name: story[1], patterns, allStoryIds });
      continue;
    }

    const page = DOCS_PAGE.exec(change.path);
    if (page && docsNarrowable) {
      addRoute({ segment: page[1], patterns, allRoutes, source: change.path });
      continue;
    }

    const demo = DEMO_FILE.exec(change.path);
    if (demo && docsNarrowable) {
      addRoute({ segment: `components/${demo[1]}`, patterns, allRoutes, source: change.path });
      continue;
    }

    /* Unmappable. Whatever project it belongs to runs whole — never the world,
       never nothing. `styles.css`, `src/lib/`, `.storybook/`, packages/tokens
       and every config file land here. */
    if (isIn(change.path, 'apps/storybook') || isShared(change.path)) {
      if (storybookNarrowable) {
        storybookNarrowable = false;
        for (const id of allStoryIds) {
          patterns.add(`${id.split('--')[0]}--`);
        }
        reasons.push(`${change.path} cannot be narrowed, so every storybook shot runs`);
      }
    }

    if (isIn(change.path, 'apps/docs') || isShared(change.path)) {
      if (docsNarrowable) {
        docsNarrowable = false;
        for (const route of allRoutes) {
          patterns.add(routePattern(route));
        }
        reasons.push(`${change.path} cannot be narrowed, so every docs shot runs`);
      }
    }
  }

  if (patterns.size === 0) {
    return {
      run: false,
      grep: null,
      reason: 'nothing in the change maps to a shot',
    };
  }

  return {
    run: true,
    grep: [...patterns].join('|'),
    reason:
      reasons.length > 0 ? reasons.join('; ') : 'scoped to the components and routes that changed',
  };

  function addComponent({ name, patterns: out, allStoryIds: ids, allRoutes: routes }) {
    let matched = false;

    if (storybookNarrowable) {
      const prefix = storyPrefix(name);
      if (ids.some((id) => id.startsWith(prefix))) {
        out.add(prefix);
        matched = true;
      }
    } else if (storybookAffected) {
      matched = true;
    }

    const route = `/components/${docsSlug(name)}`;
    if (docsNarrowable) {
      if (routes.includes(route)) {
        out.add(routePattern(route));
        matched = true;
      }
    } else if (docsAffected) {
      matched = true;
    }

    /* Loud on purpose. A component renamed without its story or its docs slug
       following would otherwise stop being tested, and the run would be green.
       visual-sweep.test.mjs makes the same argument one layer down: a filter
       that quietly drops a page produces a suite that covers nothing and
       reports nothing. */
    if (!matched) {
      throw new Error(
        `visual-scope: '${name}' matched no story id '${storyPrefix(name)}*' and no route '${route}'. ` +
          'Either the component has no coverage, or its story title or docs slug has drifted from its ' +
          'filename. Refusing to silently narrow — fix the mapping or add the coverage.',
      );
    }
  }

  function addStories({ name, patterns: out, allStoryIds: ids }) {
    const prefix = storyPrefix(name);
    if (!ids.some((id) => id.startsWith(prefix))) {
      throw new Error(
        `visual-scope: story file for '${name}' matched no story id '${prefix}*'. ` +
          "The file's title has drifted from its filename.",
      );
    }
    out.add(prefix);
  }

  function addRoute({ segment, patterns: out, allRoutes: routes, source }) {
    const route = `/${segment}`;
    if (!routes.includes(route)) {
      throw new Error(
        `visual-scope: '${source}' maps to route '${route}', which the suite does not enumerate. ` +
          'Either the page is excluded from the sweep or the path convention has changed.',
      );
    }
    out.add(routePattern(route));
  }
}

function isIn(path, prefix) {
  return path.startsWith(`${prefix}/`);
}

/* Changes outside both apps that can still reach their rendering: the packages
   they consume, and the suite's own configuration. */
function isShared(path) {
  return (
    path.startsWith('packages/') ||
    path === 'playwright.config.ts' ||
    path.startsWith('tests/visual/')
  );
}

/** The projects Nx reports as affected between `base` and the working tree. */
export function affectedProjects(base, { cwd = process.cwd() } = {}) {
  const stdout = execFileSync(
    'pnpm',
    ['exec', 'nx', 'show', 'projects', '--affected', `--base=${base}`],
    {
      cwd,
      encoding: 'utf8',
    },
  );
  /* `nx show projects` prints a JSON array when its output is not a TTY. */
  return JSON.parse(stdout.trim());
}

/** The files changed between `base` and HEAD, as statuses and paths. */
export function changedFiles(base, { cwd = process.cwd() } = {}) {
  const stdout = execFileSync('git', ['diff', '--name-status', `${base}...HEAD`], {
    cwd,
    encoding: 'utf8',
  });
  return parseNameStatus(stdout);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const base = process.argv[process.argv.indexOf('--base') + 1];
  if (!base || base === '--base') {
    throw new Error('visual-scope: --base <sha> is required');
  }

  const plan = scopeFor({
    changes: changedFiles(base),
    affectedProjects: affectedProjects(base),
    shots: listShots(),
  });

  process.stdout.write(JSON.stringify(plan));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm exec nx test scripts
```

Expected: PASS. If the fan-out tests fail, do not relax them — they encode the PR #88 measurement.

- [ ] **Step 5: Verify against the real suite**

```bash
node -e "
import('./scripts/visual-scope.mjs').then(async (m) => {
  const { listShots } = await import('./scripts/visual-shots.mjs');
  const shots = listShots();
  const plan = m.scopeFor({
    changes: [{ status: 'M', path: 'packages/react/src/components/atoms/Button.tsx' }],
    affectedProjects: ['react', 'docs', 'storybook'],
    shots,
  });
  console.log(plan.grep);
});
"
```

Expected output: `components-button--|/components/button · `

Then confirm Playwright agrees that pattern selects 30 tests:

```bash
pnpm exec playwright test --list --grep "components-button--|/components/button · " 2>&1 | tail -1
```

Expected: `Total: 30 tests in 1 file`.

- [ ] **Step 6: Verify the fan-out selects every docs shot**

```bash
node -e "
Promise.all([import('./scripts/visual-scope.mjs'), import('./scripts/visual-shots.mjs')]).then(([m, s]) => {
  const plan = m.scopeFor({
    changes: [{ status: 'A', path: 'packages/react/src/components/atoms/VerdictBadge.tsx' }],
    affectedProjects: ['react', 'docs', 'storybook'],
    shots: s.listShots(),
  });
  require('node:fs').writeFileSync('/tmp/fanout-grep.txt', plan.grep);
  console.log(plan.reason);
});
"
pnpm exec playwright test --list --grep "$(cat /tmp/fanout-grep.txt)" 2>&1 | tail -1
```

Expected: the reason mentions the sidebar, and the count is **156** — all 142 `docs-wide` plus all 14 `docs-narrow`. It must not be 2.

Note: `VerdictBadge` does not exist on `main`, so the storybook side of this call would throw the loud guard. If it does, that is the guard working; add a temporary shot for it in the snippet, or run this check on a branch where the component exists.

- [ ] **Step 7: Commit**

```bash
git add scripts/visual-scope.mjs scripts/visual-scope.test.mjs
git commit -m "$(cat <<'EOF'
test(visual): select the shots a change could have altered

Nx decides whether docs and storybook run at all, then file patterns narrow
to individual stories and routes. The sidebar fan-out rule comes first and
overrides the narrowing: adding or removing a component changes every docs
page, because site-map.ts derives the sidebar from the manifest. Without it
this module would have turned PR #88 green while 142 stale baselines rode
onto main.

Unmappable changes fall back to the affected project's shots, never the
world and never nothing. A component that maps to no shot throws.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `scripts/visual-failures.mjs` and the JSON reporter

The `visual-accept` path and the `main` recovery both need to know which shots failed. Reading a JSON report is the only way to get that without parsing logs.

**Files:**

- Modify: `playwright.config.ts`
- Create: `scripts/visual-failures.mjs`
- Test: `scripts/visual-failures.test.mjs`

**Interfaces:**

- Consumes: `grepFor` from `./visual-missing.mjs` (Task 3).
- Produces:
  - `failedTitles(report: object): string[]`
  - CLI: `node scripts/visual-failures.mjs <report.json>` prints a grep pattern, or nothing

- [ ] **Step 1: Add the JSON reporter**

In `playwright.config.ts`, the config object passed to `defineVisualConfig` gains a `reporter` key. Check first whether the preset already sets one:

```bash
grep -n "reporter" packages/ai-patterns/src/testing/visual-config.mjs
```

If the preset sets a reporter, add the JSON one alongside it here rather than replacing it. Add to the object literal in `playwright.config.ts`, directly after `testDir`:

```ts
    /* The HTML report is for a person; this one is for the workflow. The
       `visual-accept` label and the recovery on main both need the exact set of
       failing shots, and reading it from a report beats parsing 14 minutes of
       log output. */
    reporter: [
      ['list'],
      ['html', { open: 'never' }],
      ['json', { outputFile: 'test-results/report.json' }],
    ],
```

- [ ] **Step 2: Write the failing test**

Create `scripts/visual-failures.test.mjs`:

```js
import { describe, expect, it } from 'vitest';

import { failedTitles } from './visual-failures.mjs';

const report = {
  suites: [
    {
      specs: [
        { title: 'components-button--primary · light', ok: true, tests: [{ status: 'expected' }] },
        { title: 'components-badge--default · dark', ok: false, tests: [{ status: 'unexpected' }] },
        {
          title: '/patterns/forms · light @responsive',
          ok: false,
          tests: [{ status: 'unexpected' }],
        },
      ],
      suites: [
        {
          specs: [{ title: '/ · dark', ok: false, tests: [{ status: 'unexpected' }] }],
        },
      ],
    },
  ],
};

describe('failedTitles', () => {
  it('returns only the failing specs', () => {
    expect(failedTitles(report).sort()).toEqual([
      '/ · dark',
      '/patterns/forms · light @responsive',
      'components-badge--default · dark',
    ]);
  });

  it('recurses into nested suites', () => {
    expect(failedTitles(report)).toContain('/ · dark');
  });

  it('de-duplicates a title that failed in more than one project', () => {
    const twice = {
      suites: [
        {
          specs: [
            { title: 'a · light', ok: false, tests: [{ status: 'unexpected' }] },
            { title: 'a · light', ok: false, tests: [{ status: 'unexpected' }] },
          ],
        },
      ],
    };
    expect(failedTitles(twice)).toEqual(['a · light']);
  });

  it('is empty for a clean report', () => {
    expect(failedTitles({ suites: [] })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm exec nx test scripts
```

Expected: FAIL — cannot resolve `./visual-failures.mjs`.

- [ ] **Step 4: Write the implementation**

Create `scripts/visual-failures.mjs`:

```js
/* The shots that failed, from Playwright's JSON report.
 *
 * Both recovery paths need this set exactly: `visual-accept` regenerates it on
 * a pull request branch, and the main sweep regenerates it onto a baselines
 * branch. Reading a report rather than parsing logs is what keeps either from
 * regenerating a shot nobody complained about. */

import { readFileSync } from 'node:fs';

import { grepFor } from './visual-missing.mjs';

function collectSpecs(node, out = []) {
  for (const spec of node.specs ?? []) {
    out.push(spec);
  }
  for (const suite of node.suites ?? []) {
    collectSpecs(suite, out);
  }
  return out;
}

/** Titles of every spec that did not pass. De-duplicated across projects. */
export function failedTitles(report) {
  const failed = new Set();

  for (const spec of collectSpecs(report)) {
    if (spec.ok === false) {
      failed.add(spec.title);
    }
  }

  return [...failed];
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const path = process.argv[2];
  if (!path) {
    throw new Error('visual-failures: a path to report.json is required');
  }

  const titles = failedTitles(JSON.parse(readFileSync(path, 'utf8')));
  const pattern = grepFor(titles.map((title) => ({ title })));
  if (pattern) {
    process.stdout.write(pattern);
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm exec nx test scripts
```

Expected: PASS, 4 new tests.

- [ ] **Step 6: Verify the reporter writes the file**

```bash
pnpm exec playwright test --grep "config.smoke" --workers=1
ls -la test-results/report.json
```

Expected: the file exists. Confirm it is git-ignored:

```bash
git check-ignore -q test-results && echo "ignored" || echo "NOT IGNORED — add it to .gitignore"
```

If not ignored, add `test-results/` to `.gitignore` as part of this task.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts scripts/visual-failures.mjs scripts/visual-failures.test.mjs
git commit -m "$(cat <<'EOF'
test(visual): read failing shots from a json report

Both recovery paths need the exact failing set — the visual-accept label on
a PR, and the baselines branch on main. Reading a report beats parsing 14
minutes of log output, and it is what stops either path regenerating a shot
nobody complained about.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: The scoped pull request job

**Files:**

- Modify: `.github/workflows/visual.yml`

**Interfaces:**

- Consumes: `scripts/visual-scope.mjs --base <sha>` (JSON on stdout), `scripts/visual-missing.mjs` (pattern on stdout), `scripts/visual-failures.mjs <path>` (pattern on stdout).
- Produces: a job named `scoped` on `pull_request`.

- [ ] **Step 1: Change the workflow triggers**

Replace the `on:` block at the top of `.github/workflows/visual.yml`:

```yaml
on:
  pull_request:
  push:
    branches:
      - main
  # 06:00 UTC daily. The sweep is the only thing that catches drift with no
  # commit behind it — a browser patch in the pinned image, or a baseline that
  # was always marginal.
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
```

- [ ] **Step 2: Widen the permissions**

The job now commits baselines to pull request branches. Replace the top-level `permissions:` block:

```yaml
# The scoped job commits baselines to the pull request branch, and the full
# sweep opens a recovery pull request and a tracking issue.
permissions:
  contents: write
  pull-requests: write
  issues: write
```

- [ ] **Step 3: Add the `scoped` job**

Add this job after the existing `image` job (which stays exactly as it is). The `visual` job is rewritten in Task 7; leave it alone for now.

````yaml
# Only the shots the change could have altered. See
# docs/superpowers/specs/2026-08-19-scoped-visual-ci-design.md for why this is
# two layers, and why the sidebar fan-out overrides the narrowing.
scoped:
  needs: image
  if: github.event_name == 'pull_request'
  runs-on: ubuntu-latest
  timeout-minutes: 60
  container:
    image: ${{ needs.image.outputs.ref }}
    options: --shm-size=1g
  env:
    HUSKY: 0
    STORYBOOK_DISABLE_TELEMETRY: 1
  steps:
    - uses: actions/checkout@v7
      with:
        # The scoper diffs against the merge base, and the commit steps push
        # back to the branch — neither works on a detached merge commit with
        # no history.
        ref: ${{ github.event.pull_request.head.ref }}
        repository: ${{ github.event.pull_request.head.repo.full_name }}
        fetch-depth: 0
    - name: Set up pnpm via corepack
      run: |
        corepack enable
        corepack prepare --activate
        pnpm --version
    - name: Locate the pnpm store
      id: pnpm_store
      run: echo "path=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"
    - uses: actions/cache@v6
      with:
        path: ${{ steps.pnpm_store.outputs.path }}
        key: ${{ runner.os }}-pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}
        restore-keys: ${{ runner.os }}-pnpm-store-
    - run: pnpm install --frozen-lockfile
    # The scoper and the missing-baseline detector both enumerate through
    # Playwright, which needs both builds to collect a single test.
    - name: Build Storybook and the docs site
      run: pnpm run pretest:visual

    - name: Identify the merge base
      id: base
      shell: bash
      run: |
        set -euo pipefail
        git config --global --add safe.directory "$GITHUB_WORKSPACE"
        git fetch --no-tags origin "${{ github.event.pull_request.base.ref }}"
        echo "sha=$(git merge-base HEAD FETCH_HEAD)" >> "$GITHUB_OUTPUT"

    - name: Decide what to run
      id: scope
      shell: bash
      run: |
        set -euo pipefail
        node scripts/visual-scope.mjs --base "${{ steps.base.outputs.sha }}" > /tmp/plan.json
        cat /tmp/plan.json

        # The grep goes to a file rather than a step output: it can be long
        # (the fan-out case names every route) and it contains characters
        # that a $GITHUB_OUTPUT round trip would mangle.
        node -pe 'JSON.parse(require("fs").readFileSync("/tmp/plan.json","utf8")).grep ?? ""' > /tmp/scope-grep.txt

        RUN=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/plan.json","utf8")).run')
        REASON=$(node -pe 'JSON.parse(require("fs").readFileSync("/tmp/plan.json","utf8")).reason')
        echo "run=$RUN" >> "$GITHUB_OUTPUT"

        printf '### Visual scope\n\n%s\n' "$REASON" >> "$GITHUB_STEP_SUMMARY"

    - name: Nothing to check
      if: steps.scope.outputs.run != 'true'
      run: cat /tmp/plan.json

    # Missing baselines are new work, not regressions. Minting them here is
    # what stops a component-adding pull request costing 14 minutes and a
    # manual dispatch. This can only ever CREATE a baseline — it cannot
    # overwrite one, which is what keeps it from laundering a regression.
    - name: Mint baselines for new shots
      if: steps.scope.outputs.run == 'true'
      id: mint
      shell: bash
      env:
        DS_VISUAL_CONTAINER: '1'
      run: |
        set -euo pipefail
        MISSING=$(node scripts/visual-missing.mjs || true)
        if [ -z "$MISSING" ]; then
          echo "Every shot already has a baseline."
          echo "minted=0" >> "$GITHUB_OUTPUT"
          exit 0
        fi
        pnpm exec playwright test --update-snapshots --workers=1 --grep "$MISSING"
        COUNT=$(git status --porcelain -- tests/visual/__screenshots__ | wc -l | tr -d ' ')
        echo "minted=$COUNT" >> "$GITHUB_OUTPUT"

    - name: Commit the new baselines
      if: steps.mint.outputs.minted != '0' && steps.mint.outputs.minted != ''
      shell: bash
      run: |
        set -euo pipefail
        git config --global --add safe.directory "$GITHUB_WORKSPACE"
        git config user.name 'github-actions[bot]'
        git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
        git add tests/visual/__screenshots__
        git commit -m "test(visual): ${{ steps.mint.outputs.minted }} new baselines" \
                   -m "Generated on the runner for shots that had none. Review the images in this diff."
        git push origin "HEAD:${{ github.event.pull_request.head.ref }}"

    # No DS_VISUAL_CONTAINER: the config pins updateSnapshots to 'none'
    # without it, so a baseline that is still missing at this point is a hard
    # failure rather than something quietly written.
    - name: Visual regression, scoped
      if: steps.scope.outputs.run == 'true'
      id: check
      continue-on-error: true
      shell: bash
      run: |
        set -euo pipefail
        pnpm exec playwright test --workers=1 --grep "$(cat /tmp/scope-grep.txt)"

    # Overwriting an existing baseline is the operation the zero-tolerance
    # comparison exists to put a human in front of, so it is opt-in per pull
    # request and never automatic.
    - name: Accept the changed baselines
      if: steps.check.outcome == 'failure' && contains(github.event.pull_request.labels.*.name, 'visual-accept')
      shell: bash
      env:
        DS_VISUAL_CONTAINER: '1'
      run: |
        set -euo pipefail
        FAILED=$(node scripts/visual-failures.mjs test-results/report.json)
        if [ -z "$FAILED" ]; then
          echo "The check failed but no shot is listed as failing — this is not a baseline problem."
          exit 1
        fi
        pnpm exec playwright test --update-snapshots --workers=1 --grep "$FAILED"
        COUNT=$(git status --porcelain -- tests/visual/__screenshots__ | wc -l | tr -d ' ')
        git config --global --add safe.directory "$GITHUB_WORKSPACE"
        git config user.name 'github-actions[bot]'
        git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
        git add tests/visual/__screenshots__
        git commit -m "test(visual): accept ${COUNT} baselines" \
                   -m "Accepted via the visual-accept label on this pull request. Review the images in this diff."
        git push origin "HEAD:${{ github.event.pull_request.head.ref }}"
        echo "Accepted ${COUNT} baselines." >> "$GITHUB_STEP_SUMMARY"

    - name: Report the failing shots
      if: steps.check.outcome == 'failure' && !contains(github.event.pull_request.labels.*.name, 'visual-accept')
      shell: bash
      run: |
        set -euo pipefail
        {
          echo "### Visual regression"
          echo
          echo "If these changes are intended, add the \`visual-accept\` label and re-run this job."
          echo
          echo '```'
          node scripts/visual-failures.mjs test-results/report.json | tr '|' '\n'
          echo '```'
        } >> "$GITHUB_STEP_SUMMARY"
        exit 1

    - name: Upload report and diffs
      if: ${{ !cancelled() }}
      uses: actions/upload-artifact@v7
      with:
        name: visual-report-scoped
        path: |
          playwright-report/
          test-results/
        retention-days: 14
        if-no-files-found: ignore
````

- [ ] **Step 4: Create the label**

```bash
gh label create visual-accept \
  --description "Regenerate the failing visual baselines onto this branch" \
  --color FBCA04
```

- [ ] **Step 5: Validate the workflow syntax**

```bash
gh workflow view Visual --yaml > /dev/null && echo "parsed"
```

If `gh` cannot parse it because it is not yet pushed, use any local YAML check, e.g.:

```bash
node -e "require('node:fs').readFileSync('.github/workflows/visual.yml','utf8')" && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/visual.yml')); print('valid yaml')"
```

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/visual.yml
git commit -m "$(cat <<'EOF'
ci(visual): run only the shots a pull request could have changed

Mints baselines for new shots in the same run, so adding a component no
longer costs 14 minutes and a manual Visual update dispatch. Minting can
only create a baseline, never overwrite one; accepting an intended change
to an existing baseline is the opt-in visual-accept label.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: The full sweep and its recovery path

**Files:**

- Modify: `.github/workflows/visual.yml`

**Interfaces:**

- Consumes: `scripts/visual-failures.mjs` (Task 5).
- Produces: a job named `full` replacing the current `visual` job.

- [ ] **Step 1: Rename the job and change its condition**

In `.github/workflows/visual.yml`, rename the `visual:` job to `full:` and give it a condition so it never runs on a pull request:

```yaml
full:
  needs: image
  if: github.event_name != 'pull_request'
```

- [ ] **Step 2: Drop `continue-on-error` from the job**

Delete this line and the comment above it from the `full` job:

```yaml
# Advisory. Issue #65 records the criterion for making this required: ten
# consecutive PRs with no false failure. Flipping it is a checklist item
# there, not a someday — delete this line when the criterion is met.
continue-on-error: true
```

The failure now has somewhere to go — a baselines pull request and a tracking issue — so an advisory green that hides it is worse than a red.

- [ ] **Step 3: Make the sweep step tolerate failure so the recovery can run**

Change the `Visual regression` step in the `full` job to:

```yaml
- name: Visual regression
  id: sweep
  continue-on-error: true
  run: pnpm exec playwright test --workers=1
```

- [ ] **Step 4: Add the recovery steps**

Insert these after the existing `Upload report and diffs` step in the `full` job:

````yaml
# A red sweep on main means either an intended change nobody regenerated
# or a real regression, and telling them apart is a visual judgement. So
# the workflow does the mechanical half — regenerate exactly the failing
# shots onto a branch — and leaves the judgement in a pull request.
- name: Regenerate the failing baselines
  if: steps.sweep.outcome == 'failure'
  id: regen
  shell: bash
  env:
    DS_VISUAL_CONTAINER: '1'
  run: |
    set -euo pipefail
    FAILED=$(node scripts/visual-failures.mjs test-results/report.json)
    if [ -z "$FAILED" ]; then
      echo "The sweep failed with no failing shot listed — a crash or a build break, not a baseline."
      echo "recovered=false" >> "$GITHUB_OUTPUT"
      exit 0
    fi

    COUNT=$(echo "$FAILED" | tr '|' '\n' | wc -l | tr -d ' ')
    echo "$FAILED" | tr '|' '\n' > /tmp/failing-shots.txt

    pnpm exec playwright test --update-snapshots --workers=1 --grep "$FAILED"

    echo "count=$COUNT" >> "$GITHUB_OUTPUT"
    echo "recovered=true" >> "$GITHUB_OUTPUT"

- name: Open the baselines pull request and the tracking issue
  if: steps.regen.outputs.recovered == 'true'
  shell: bash
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    set -euo pipefail
    git config --global --add safe.directory "$GITHUB_WORKSPACE"
    git config user.name 'github-actions[bot]'
    git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

    SHORT=$(git rev-parse --short HEAD)
    BRANCH="visual/baselines-${SHORT}"
    RUN_URL="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
    COUNT="${{ steps.regen.outputs.count }}"

    git checkout -b "$BRANCH"
    git add tests/visual/__screenshots__
    git commit -m "test(visual): regenerate ${COUNT} baselines from ${SHORT}"
    git push origin "$BRANCH"

    # The issue first, so the pull request can name it; then the pull
    # request; then the issue is edited to name the pull request back.
    # Either one alone loses half the context a week later.
    ISSUE_URL=$(gh issue create \
      --title "Visual sweep red on main (${SHORT})" \
      --label visual \
      --body "$(printf '%s\n' \
        "The full sweep failed on \`main\` at \`${SHORT}\`." \
        "" \
        "- Failing run: ${RUN_URL}" \
        "- Failing shots: ${COUNT} (see \`visual-report\` artifact on that run for images)" \
        "" \
        "A branch with the regenerated baselines is open as a pull request — merging it accepts these as the intended look, closing it says this is a real regression." \
        "" \
        "<details><summary>Failing shots</summary>" \
        "" \
        '```' \
        "$(cat /tmp/failing-shots.txt)" \
        '```' \
        "</details>")")

    PR_URL=$(gh pr create \
      --head "$BRANCH" \
      --base main \
      --title "visual: ${COUNT} baselines changed on main" \
      --body "$(printf '%s\n' \
        "The full sweep went red on \`main\` at \`${SHORT}\` and these ${COUNT} baselines were regenerated on the runner." \
        "" \
        "**Merge** if this is the look you intended — these become the baselines." \
        "**Close** if it is a regression; the tracking issue stays open with the evidence." \
        "" \
        "- Tracking issue: ${ISSUE_URL}" \
        "- Failing run: ${RUN_URL}")")

    gh issue comment "$ISSUE_URL" --body "Regenerated baselines: ${PR_URL}"

    {
      echo "### Visual sweep red — recovery opened"
      echo
      echo "- Pull request: ${PR_URL}"
      echo "- Issue: ${ISSUE_URL}"
    } >> "$GITHUB_STEP_SUMMARY"

- name: Fail the job
  if: steps.sweep.outcome == 'failure'
  run: exit 1
````

- [ ] **Step 5: Create the `visual` label used by the issue**

```bash
gh label create visual --description "Visual regression suite" --color 1D76DB || true
```

- [ ] **Step 6: Validate the YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/visual.yml')); print('valid yaml')"
```

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/visual.yml
git commit -m "$(cat <<'EOF'
ci(visual): move the full sweep to main and nightly, with a way back

The sweep no longer runs on pull requests. When it goes red on main the
workflow regenerates exactly the failing shots onto a branch and opens a
pull request plus a tracking issue that reference each other: merging the
PR accepts the new look, closing it says regression and leaves the issue
holding the evidence.

continue-on-error is dropped now that a red has somewhere to go.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Document the topology and the fan-out

**Files:**

- Modify: `docs/agents/visual-regression.md`

- [ ] **Step 1: Add the new section**

Insert immediately after the opening paragraphs of `docs/agents/visual-regression.md`, before `## 1. Establish what kind of failure it is, by size`:

```markdown
---

## Where the suite runs, and how to get back to green

| event | what runs |
| --- | --- |
| pull request | only the shots the change could have altered, plus any that have no baseline yet |
| push to `main` | the full sweep |
| nightly, 06:00 UTC | the full sweep |
| `workflow_dispatch` | the full sweep, or `--grep` a subset |

**A new component's shots are minted automatically.** The pull request job
generates baselines for shots that have none and commits them to the branch, so
adding a component no longer needs a manual **Visual update** dispatch. It can
only ever create a baseline, never overwrite one.

**An intended change to an existing baseline needs the `visual-accept` label.**
Add it to the pull request and re-run the job: it regenerates exactly the shots
that failed and commits them. This is opt-in because overwriting a baseline is
the one operation the zero-tolerance comparison exists to put a person in front
of.

**A red sweep on `main` opens its own recovery.** The workflow regenerates the
failing shots onto a `visual/baselines-<sha>` branch, opens a pull request, and
opens a tracking issue that links to it. Merge the pull request if the change
was intended; close it if it is a regression, and the issue stays open with the
run, the artifact and the failing list.

### Adding a component fails every docs baseline, and that is correct

`apps/docs/src/lib/site-map.ts` derives the sidebar from the generated component
manifest, and the sidebar is on every docs page. So **adding or removing a
component changes every docs shot** — on PR #88 that was 142 pre-existing docs
pages failing comparison, with zero story failures.

This is not a bug and there is nothing to fix in the site. It is why
`scripts/visual-scope.mjs` treats an added or deleted component file as a
docs-wide event rather than narrowing to that component's own page: narrowing
there would produce a green pull request and 142 stale baselines on `main`.

Expect it, add `visual-accept`, and review the images in the diff.

---
```

- [ ] **Step 2: Update the stale line in "Working conditions"**

That section currently says `visual.yml` is advisory. Replace this bullet:

```markdown
- **`visual.yml` is advisory** (`continue-on-error`), so a red visual job does not block anything while you work. Note that this also means the workflow run reports success — read the job, not the run.
```

with:

```markdown
- **`visual.yml` reports honestly.** `continue-on-error` was dropped once a red had somewhere to go, so a failing job now fails its run. Nothing on `main` is branch-protected, so this changes what you see rather than what merges.
```

- [ ] **Step 3: Verify formatting passes**

```bash
pnpm format:check
```

Expected: PASS. If prettier reflows the tables, run `pnpm format` and include the result.

- [ ] **Step 4: Commit**

```bash
git add docs/agents/visual-regression.md
git commit -m "$(cat <<'EOF'
docs(visual): record the new topology and the sidebar fan-out

The fan-out especially: adding a component fails every docs baseline
because the sidebar derives from the manifest, and someone meeting 142 red
docs pages should be able to look that up rather than diagnose it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Verify end to end

No code. This is the gate before the pull request is ready.

- [ ] **Step 1: Full local check**

```bash
pnpm install
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Expected: all pass, and `pnpm test` now includes the `scripts` project.

- [ ] **Step 2: Open the pull request**

```bash
git push -u origin HEAD
gh pr create --fill
```

- [ ] **Step 3: Confirm the scoped job did the right thing**

This branch touches `scripts/`, `.github/`, `docs/` and `playwright.config.ts`. `playwright.config.ts` is in `isShared`, so expect the sweep to run whole — the honest answer, since the config governs every shot.

```bash
gh run watch
```

Read the job summary. It must state a reason, and the reason must match what the change actually was. A summary claiming a narrow scope on a `playwright.config.ts` change is a bug in `isShared`.

- [ ] **Step 4: Prove the scoping works on a change that should be narrow**

```bash
git checkout -b visual-scope-smoke
printf '\n/* scope smoke test */\n' >> packages/react/src/components/atoms/Button.css
git commit -am "test: temporary change to exercise visual scoping"
git push -u origin HEAD
gh pr create --fill --title "test: exercise visual scoping" --body "Temporary. Close without merging."
gh run watch
```

Expected: the scoped job runs **30 tests**, not 501, and its summary says it scoped to the components and routes that changed.

Then close it and delete the branch:

```bash
gh pr close --delete-branch
```

- [ ] **Step 5: Prove the fan-out works**

```bash
git checkout -b visual-fanout-smoke
cp packages/react/src/components/atoms/Badge.tsx packages/react/src/components/atoms/ScopeProbe.tsx
git add packages/react/src/components/atoms/ScopeProbe.tsx
git commit -m "test: temporary added component to exercise the sidebar fan-out"
git push -u origin HEAD
gh pr create --fill --title "test: exercise the sidebar fan-out" --body "Temporary. Close without merging."
gh run watch
```

Expected: the job's summary reason mentions the sidebar, and the run covers **all 156 docs shots**. If the loud guard throws instead — `ScopeProbe` has no story and no docs page — that is also a correct outcome and proves the guard; record which happened.

Close it:

```bash
gh pr close --delete-branch
```

- [ ] **Step 6: Report the results**

Tell the user, with the run URLs:

- the scoped run's test count on the narrow change (expected 30)
- the fan-out run's behaviour (156 docs shots, or the guard throwing)
- whether any baseline was auto-committed, and to which branch

Do not merge. The user decides.

---

## Self-Review Notes

Checked against the spec:

| spec section                                                                  | task                                    |
| ----------------------------------------------------------------------------- | --------------------------------------- |
| Component 1 (`visual-scope.mjs`), layers 1, 1a, 2, fallback, guard, anchoring | Task 4                                  |
| Component 2 (`visual-missing.mjs`)                                            | Task 3                                  |
| Component 3 (pull request job, mint, accept label, fork degradation)          | Task 6                                  |
| Component 4 (full sweep, JSON reporter, baselines PR + issue)                 | Tasks 5 and 7                           |
| Testing section                                                               | Tasks 2–5 unit tests, Task 9 end to end |
| Documentation section, `visual-accept` label creation                         | Tasks 6 and 8                           |

**Known gap, deliberately left:** the spec's fork-degradation paragraph describes detecting a read-only token and failing with the explicit `visual-update` remedy. Task 6 checks out `github.event.pull_request.head.repo.full_name`, which makes a fork's push fail with a permissions error rather than that message. The repository is restricted and takes no fork pull requests, so this is left as a rough edge rather than built; if a fork pull request ever arrives, the fix is a guard on `github.event.pull_request.head.repo.fork` before the commit steps.
