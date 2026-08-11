# ds-resync Selective Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `ds-resync` upgrade a chosen subset of `@elirobinson/*` packages, each to a chosen distance (`latest` / `minor` / `patch`), non-interactively via flags or interactively via a prompt walk.

**Architecture:** Two new pure modules (`selectTarget` in `semver.mjs`, a `targets.mjs` for the CLI vocabulary) plus a `prompt.mjs` whose input channel is injected so it tests without a TTY. `cli.mjs`'s `inspect` splits into `survey` (detect + fetch version lists) and `resolve` (pick targets, fetch changelogs), so interactive selection happens between them and never pays for changelogs of packages you decline.

**Tech Stack:** Node ESM (`.mjs`), Vitest 3, `npm view … versions --json`.

**Spec:** `docs/superpowers/specs/2026-08-10-ds-resync-selective-design.md`

## Global Constraints

- All new files are `.mjs` ESM in `packages/ai-patterns/src/resync/`. No TypeScript, no build step.
- No runtime dependencies may be added to `@elirobinson/ai-patterns`. Node builtins only.
- Valid targets are exactly `latest`, `minor`, `patch`. Any other value is an error.
- The scope prefix is exactly `@elirobinson/`. Short names given to `--only` and `--target` are normalised by prepending it.
- Prereleases are never selected as an upgrade target, but a prerelease is valid as the _current_ version.
- `--interactive` implies `--write`. It exits `1` when stdin is not a TTY.
- Exit codes are unchanged: `0` success, `1` error, `2` outdated only with `--fail-on-outdated`.
- Every new file must pass `pnpm lint` and `pnpm format:check`. The pre-commit hook runs both.
- Work continues on branch `feat/ds-resync`; PR #20 updates on push.

---

### Task 1: `selectTarget` version resolution

**Files:**

- Modify: `packages/ai-patterns/src/resync/semver.mjs`
- Test: `packages/ai-patterns/src/resync/semver.test.mjs`

**Interfaces:**

- Consumes: `parseVersion`, `compareVersions` (already in this file).
- Produces: `selectTarget(current: string, versions: string[], target: 'latest'|'minor'|'patch') => string | null` — the highest non-prerelease version in `versions` that is `>= current` and satisfies the target constraint. `null` when no candidate qualifies.

  Consumed by `cli.mjs` (Task 4) and `prompt.mjs` (Task 5).

- [ ] **Step 1: Write the failing test**

Append to `packages/ai-patterns/src/resync/semver.test.mjs`. Also add `selectTarget` to the existing import at the top of the file, so it reads:

```js
import { compareVersions, jumpClass, parseVersion, selectTarget } from './semver.mjs';
```

Then append:

```js
describe('selectTarget', () => {
  const VERSIONS = ['1.0.0', '1.0.2', '1.2.0', '1.2.3', '1.4.0', '2.0.0', '2.1.0'];

  it('takes the newest published version for latest', () => {
    expect(selectTarget('1.0.2', VERSIONS, 'latest')).toBe('2.1.0');
  });

  it('stays inside the current major for minor', () => {
    expect(selectTarget('1.0.2', VERSIONS, 'minor')).toBe('1.4.0');
  });

  it('stays inside the current major.minor for patch', () => {
    expect(selectTarget('1.2.0', VERSIONS, 'patch')).toBe('1.2.3');
  });

  it('returns the current version when it is already the ceiling', () => {
    expect(selectTarget('2.1.0', VERSIONS, 'latest')).toBe('2.1.0');
    expect(selectTarget('1.4.0', VERSIONS, 'minor')).toBe('1.4.0');
  });

  it('never selects a prerelease', () => {
    expect(selectTarget('1.0.0', ['1.0.0', '1.1.0', '2.0.0-beta.1'], 'latest')).toBe('1.1.0');
  });

  it('accepts a prerelease as the current version', () => {
    expect(selectTarget('1.0.0-beta.1', ['1.0.0-beta.1', '1.0.0'], 'latest')).toBe('1.0.0');
  });

  it('returns null when nothing qualifies', () => {
    expect(selectTarget('1.0.0', [], 'latest')).toBeNull();
    expect(selectTarget('3.0.0', VERSIONS, 'latest')).toBeNull();
    expect(selectTarget('1.0.0', ['0.9.0'], 'latest')).toBeNull();
  });

  it('ignores unparseable entries in the version list', () => {
    expect(selectTarget('1.0.0', ['1.0.0', 'garbage', '1.1.0'], 'latest')).toBe('1.1.0');
  });

  it('rejects an unknown target', () => {
    expect(() => selectTarget('1.0.0', VERSIONS, 'sideways')).toThrow(/Unknown target/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @elirobinson/ai-patterns test semver
```

Expected: FAIL — `selectTarget is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `packages/ai-patterns/src/resync/semver.mjs`:

```js
const TARGET_CONSTRAINTS = {
  latest: () => true,
  minor: (current, candidate) => candidate.major === current.major,
  patch: (current, candidate) =>
    candidate.major === current.major && candidate.minor === current.minor,
};

/**
 * The furthest version worth moving to, given how far the caller is willing to
 * jump. Prereleases are excluded from the candidate set — opting into one is a
 * deliberate act, not something an upgrade command should do on your behalf —
 * but a prerelease is still valid as the version you are on.
 */
export function selectTarget(current, versions, target) {
  const constraint = TARGET_CONSTRAINTS[target];
  if (!constraint) throw new TypeError(`Unknown target: ${target}`);

  const from = parseVersion(current);
  if (!from) throw new TypeError(`Unparseable version: ${current}`);

  let best = null;

  for (const value of versions) {
    const candidate = parseVersion(value);
    if (!candidate) continue;
    if (candidate.prerelease.length > 0) continue;
    if (!constraint(from, candidate)) continue;
    if (compareVersions(value, current) < 0) continue;
    if (best === null || compareVersions(value, best) > 0) best = value;
  }

  return best;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @elirobinson/ai-patterns test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-patterns/src/resync/semver.mjs packages/ai-patterns/src/resync/semver.test.mjs
git commit -m "feat(ai-patterns): resolve upgrade targets by distance"
```

---

### Task 2: The `--only` / `--target` vocabulary

**Files:**

- Create: `packages/ai-patterns/src/resync/targets.mjs`
- Test: `packages/ai-patterns/src/resync/targets.test.mjs`

**Interfaces:**

- Consumes: `SCOPE` from `./detect.mjs`.
- Produces:
  - `TARGETS` — the array `['latest', 'minor', 'patch']`
  - `normalizePackageName(name: string) => string` — prepends the scope when absent
  - `parseTargetSpec(value: string) => {fallback: string, byName: Record<string, string>}` — throws `Error` on an unknown target
  - `parseOnly(value: string) => string[]` — normalised names
  - `resolveTarget(spec: {fallback, byName}, name: string) => string`
  - `DEFAULT_TARGET_SPEC` — `{fallback: 'latest', byName: {}}`

  Consumed by `cli.mjs` (Task 4).

- [ ] **Step 1: Write the failing test**

`packages/ai-patterns/src/resync/targets.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TARGET_SPEC,
  normalizePackageName,
  parseOnly,
  parseTargetSpec,
  resolveTarget,
  TARGETS,
} from './targets.mjs';

describe('normalizePackageName', () => {
  it('prepends the scope to a short name', () => {
    expect(normalizePackageName('react')).toBe('@elirobinson/react');
  });

  it('leaves an already-qualified name alone', () => {
    expect(normalizePackageName('@elirobinson/react')).toBe('@elirobinson/react');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePackageName('  tokens ')).toBe('@elirobinson/tokens');
  });
});

describe('parseOnly', () => {
  it('splits and normalises a comma-separated list', () => {
    expect(parseOnly('react, tokens')).toEqual(['@elirobinson/react', '@elirobinson/tokens']);
  });

  it('accepts qualified names', () => {
    expect(parseOnly('@elirobinson/react')).toEqual(['@elirobinson/react']);
  });

  it('drops empty segments from a trailing comma', () => {
    expect(parseOnly('react,')).toEqual(['@elirobinson/react']);
  });
});

describe('parseTargetSpec', () => {
  it('reads a bare target as the fallback for every package', () => {
    expect(parseTargetSpec('minor')).toEqual({ fallback: 'minor', byName: {} });
  });

  it('reads per-package assignments', () => {
    expect(parseTargetSpec('react=minor,tokens=patch')).toEqual({
      fallback: 'latest',
      byName: { '@elirobinson/react': 'minor', '@elirobinson/tokens': 'patch' },
    });
  });

  it('reads a bare target mixed with assignments', () => {
    expect(parseTargetSpec('minor,react=latest')).toEqual({
      fallback: 'minor',
      byName: { '@elirobinson/react': 'latest' },
    });
  });

  it('rejects an unknown target value', () => {
    expect(() => parseTargetSpec('sideways')).toThrow(/Unknown target/);
    expect(() => parseTargetSpec('react=sideways')).toThrow(/Unknown target/);
  });

  it('names the valid targets in the error', () => {
    expect(() => parseTargetSpec('sideways')).toThrow(/latest/);
  });
});

describe('resolveTarget', () => {
  it('prefers a per-package target over the fallback', () => {
    const spec = parseTargetSpec('minor,react=patch');
    expect(resolveTarget(spec, '@elirobinson/react')).toBe('patch');
    expect(resolveTarget(spec, '@elirobinson/tokens')).toBe('minor');
  });

  it('defaults to latest', () => {
    expect(resolveTarget(DEFAULT_TARGET_SPEC, '@elirobinson/react')).toBe('latest');
  });
});

describe('TARGETS', () => {
  it('is exactly the three supported distances', () => {
    expect(TARGETS).toEqual(['latest', 'minor', 'patch']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @elirobinson/ai-patterns test targets
```

Expected: FAIL — `Failed to resolve import "./targets.mjs"`.

- [ ] **Step 3: Write the implementation**

`packages/ai-patterns/src/resync/targets.mjs`:

```js
import { SCOPE } from './detect.mjs';

export const TARGETS = ['latest', 'minor', 'patch'];

export const DEFAULT_TARGET_SPEC = { fallback: 'latest', byName: {} };

export function normalizePackageName(name) {
  const trimmed = String(name).trim();
  return trimmed.startsWith(SCOPE) ? trimmed : `${SCOPE}${trimmed}`;
}

function assertTarget(value) {
  if (!TARGETS.includes(value)) {
    throw new Error(`Unknown target: ${value}. Valid targets are ${TARGETS.join(', ')}.`);
  }
  return value;
}

export function parseOnly(value) {
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizePackageName);
}

/**
 * Accepts a bare target ("minor"), per-package assignments
 * ("react=minor,tokens=patch"), or both ("minor,react=latest") — the bare one
 * becomes the fallback for packages with no assignment of their own.
 */
export function parseTargetSpec(value) {
  const spec = { fallback: 'latest', byName: {} };

  for (const part of String(value).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      spec.fallback = assertTarget(trimmed);
      continue;
    }

    const name = normalizePackageName(trimmed.slice(0, separator));
    spec.byName[name] = assertTarget(trimmed.slice(separator + 1).trim());
  }

  return spec;
}

export function resolveTarget(spec, name) {
  return spec.byName[name] ?? spec.fallback;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @elirobinson/ai-patterns test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-patterns/src/resync/targets.mjs packages/ai-patterns/src/resync/targets.test.mjs
git commit -m "feat(ai-patterns): parse the --only and --target vocabulary"
```

---

### Task 3: `fetchAllVersions`

**Files:**

- Modify: `packages/ai-patterns/src/resync/registry.mjs`
- Test: `packages/ai-patterns/src/resync/registry.test.mjs`

**Interfaces:**

- Consumes: the existing private `runNpm` helper in this file.
- Produces: `fetchAllVersions(name: string, options?: {cwd?: string}) => string[]` — every published version, oldest first. Throws `RegistryError` on failure.

  Consumed by `cli.mjs` (Task 4).

`npm view <pkg> versions --json` returns an array for a package with several versions, but a bare string when only one version exists. Both shapes must be handled — this is the same quirk `fetchLatestVersion` already works around.

- [ ] **Step 1: Write the failing test**

Add `normalizeVersionsPayload` to the import in `packages/ai-patterns/src/resync/registry.test.mjs`:

```js
import { describeNpmFailure, normalizeVersionsPayload, RegistryError } from './registry.mjs';
```

Then append:

```js
describe('normalizeVersionsPayload', () => {
  it('passes an array through', () => {
    expect(normalizeVersionsPayload(['1.0.0', '1.1.0'])).toEqual(['1.0.0', '1.1.0']);
  });

  it('wraps the bare string npm returns for a single-version package', () => {
    expect(normalizeVersionsPayload('1.0.0')).toEqual(['1.0.0']);
  });

  it('returns an empty list for null', () => {
    expect(normalizeVersionsPayload(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @elirobinson/ai-patterns test registry
```

Expected: FAIL — `normalizeVersionsPayload is not a function`.

- [ ] **Step 3: Write the implementation**

In `packages/ai-patterns/src/resync/registry.mjs`, add after `fetchLatestVersion`:

```js
/**
 * `npm view … versions --json` yields an array normally, but a bare string when
 * the package has exactly one published version.
 */
export function normalizeVersionsPayload(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string') return [parsed];
  return [];
}

export function fetchAllVersions(name, { cwd = process.cwd() } = {}) {
  return normalizeVersionsPayload(JSON.parse(runNpm(['view', name, 'versions', '--json'], cwd)));
}
```

`fetchLatestVersion` stays as it is — it is the cheaper call and remains correct for anything that only needs the tip.

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @elirobinson/ai-patterns test
```

Expected: PASS.

- [ ] **Step 5: Verify against the real registry**

```bash
node --input-type=module -e "
import { fetchAllVersions } from './packages/ai-patterns/src/resync/registry.mjs';
console.log(fetchAllVersions('@elirobinson/react', { cwd: 'templates/default-app' }));
"
```

Expected: an array of published react versions including `1.1.0`. Requires registry auth.

- [ ] **Step 6: Commit**

```bash
git add packages/ai-patterns/src/resync/registry.mjs packages/ai-patterns/src/resync/registry.test.mjs
git commit -m "feat(ai-patterns): fetch the full published version list"
```

---

### Task 4: Thread targets through the CLI

Splits `inspect` into `survey` and `resolve` so Task 5 can insert interactive selection between them, and so declined packages never cost a changelog download.

**Files:**

- Modify: `packages/ai-patterns/src/resync/cli.mjs`
- Test: `packages/ai-patterns/src/resync/cli.test.mjs`

**Interfaces:**

- Consumes: `selectTarget` (Task 1); `parseOnly`, `parseTargetSpec`, `resolveTarget`, `DEFAULT_TARGET_SPEC` (Task 2); `fetchAllVersions` (Task 3).
- Produces:
  - `parseArgs` gains `only: string[] | null`, `targetSpec: {fallback, byName}`, `interactive: boolean`
  - `survey(cwd: string, only: string[]|null) => {packageJsonPath: string, entries: Array<{name, declaredRange, field, installedVersion, reference, versions}>}`
  - `resolve(surveyed: object, targetSpec: object, cwd: string) => {packageJsonPath, packages, wrote: false}` — each package gains `targetVersion`, `latestVersion`, `target`, `heldBack`

  `prompt.mjs` (Task 5) consumes the `entries` shape from `survey`.

- [ ] **Step 1: Write the failing test**

Replace the import line at the top of `packages/ai-patterns/src/resync/cli.test.mjs` with:

```js
import { formatReport, parseArgs } from './cli.mjs';
```

(unchanged — listed so the file is unambiguous). Then append these tests:

```js
describe('parseArgs — selection', () => {
  it('defaults to every package at latest', () => {
    const args = parseArgs([]);
    expect(args.only).toBeNull();
    expect(args.targetSpec).toEqual({ fallback: 'latest', byName: {} });
    expect(args.interactive).toBe(false);
  });

  it('reads --only with short names', () => {
    expect(parseArgs(['--only', 'react,tokens']).only).toEqual([
      '@elirobinson/react',
      '@elirobinson/tokens',
    ]);
  });

  it('reads --only=value', () => {
    expect(parseArgs(['--only=react']).only).toEqual(['@elirobinson/react']);
  });

  it('reads a global --target', () => {
    expect(parseArgs(['--target', 'minor']).targetSpec).toEqual({
      fallback: 'minor',
      byName: {},
    });
  });

  it('reads per-package targets', () => {
    expect(parseArgs(['--target=react=patch']).targetSpec).toEqual({
      fallback: 'latest',
      byName: { '@elirobinson/react': 'patch' },
    });
  });

  it('rejects an unknown target', () => {
    expect(() => parseArgs(['--target', 'sideways'])).toThrow(/Unknown target/);
  });

  it('reads --interactive and -i', () => {
    expect(parseArgs(['--interactive']).interactive).toBe(true);
    expect(parseArgs(['-i']).interactive).toBe(true);
  });
});

describe('formatReport — held back', () => {
  function entry(overrides) {
    return {
      name: '@elirobinson/react',
      declaredRange: '^1.0.0',
      installedVersion: '1.0.2',
      targetVersion: '1.4.0',
      latestVersion: '2.0.0',
      target: 'minor',
      jump: 'minor',
      outdated: true,
      heldBack: true,
      entries: [],
      ...overrides,
    };
  }

  it('reports the target version, not the latest, as the transition', () => {
    const text = formatReport({ packages: [entry()], wrote: false });
    expect(text).toContain('1.0.2 → 1.4.0');
    expect(text).not.toContain('1.0.2 → 2.0.0');
  });

  it('names the version being held back and why', () => {
    const text = formatReport({ packages: [entry()], wrote: false });
    expect(text).toContain('2.0.0 is available');
    expect(text).toContain('--target minor');
  });

  it('omits the held-back line when the target is the latest', () => {
    const text = formatReport({
      packages: [entry({ targetVersion: '2.0.0', heldBack: false, jump: 'major' })],
      wrote: false,
    });
    expect(text).not.toContain('is available, held back');
  });

  it('still notes a held-back version on an otherwise current package', () => {
    const text = formatReport({
      packages: [entry({ targetVersion: '1.0.2', outdated: false, heldBack: true, jump: 'none' })],
      wrote: false,
    });
    expect(text).toMatch(/up to date/i);
    expect(text).toContain('2.0.0 is available');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @elirobinson/ai-patterns test cli
```

Expected: FAIL — `args.only` is `undefined`, and the transition line still shows `latestVersion`.

- [ ] **Step 3: Add the new imports**

In `packages/ai-patterns/src/resync/cli.mjs`, replace the `registry.mjs` and `semver.mjs` import lines and add the `targets.mjs` import, so the import block reads:

```js
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';
import { bumpRange, detectPackageManager, installCommand, writeVersions } from './apply.mjs';
import { isBreaking, sliceChangelog } from './changelog.mjs';
import { detect } from './detect.mjs';
import { fetchAllVersions, fetchChangelog, RegistryError } from './registry.mjs';
import { compareVersions, jumpClass, selectTarget } from './semver.mjs';
import {
  DEFAULT_TARGET_SPEC,
  parseOnly,
  parseTargetSpec,
  resolveTarget,
  TARGETS,
} from './targets.mjs';
```

Note `resolve` from `node:path` is renamed to `resolvePath`, because this file gains its own `resolve` function in Step 5. Update the two existing uses inside `parseArgs` (`args.cwd = resolve(...)`) to `resolvePath(...)` in the next step.

- [ ] **Step 4: Extend the usage text and `parseArgs`**

Replace the `USAGE` constant and the whole `parseArgs` function with:

```js
const USAGE = `ds-resync — bring this repo's @elirobinson packages up to date

Usage: ds-resync [options]

Options:
  --write               Apply the upgrades and install (default is read-only)
  --only <names>        Restrict to these packages (comma-separated, scope optional)
  --target <spec>       How far to jump: ${TARGETS.join(' | ')}
                        Global ("minor") or per-package ("react=minor,tokens=latest")
  --interactive, -i     Choose per package, then apply (implies --write)
  --json                Emit the report as JSON
  --cwd <dir>           Target a directory other than the current one
  --fail-on-outdated    Exit 2 when anything is behind (for CI)
  -h, --help            Show this message
`;

export function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    cwd: process.cwd(),
    failOnOutdated: false,
    help: false,
    only: null,
    targetSpec: DEFAULT_TARGET_SPEC,
    interactive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--write') args.write = true;
    else if (argument === '--json') args.json = true;
    else if (argument === '--fail-on-outdated') args.failOnOutdated = true;
    else if (argument === '--help' || argument === '-h') args.help = true;
    else if (argument === '--interactive' || argument === '-i') args.interactive = true;
    else if (argument === '--cwd') {
      index += 1;
      args.cwd = resolvePath(argv[index] ?? '.');
    } else if (argument.startsWith('--cwd=')) {
      args.cwd = resolvePath(argument.slice('--cwd='.length));
    } else if (argument === '--only') {
      index += 1;
      args.only = parseOnly(argv[index] ?? '');
    } else if (argument.startsWith('--only=')) {
      args.only = parseOnly(argument.slice('--only='.length));
    } else if (argument === '--target') {
      index += 1;
      args.targetSpec = parseTargetSpec(argv[index] ?? '');
    } else if (argument.startsWith('--target=')) {
      args.targetSpec = parseTargetSpec(argument.slice('--target='.length));
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  // Asking which packages to update and then not updating them is not a
  // meaningful mode, so the interactive flag carries the write intent.
  if (args.interactive) args.write = true;

  return args;
}
```

- [ ] **Step 5: Replace `inspect` with `survey` and `resolve`**

Delete the existing `inspect` function and put these two in its place:

```js
/**
 * Everything that can be learned before knowing how far the caller wants to
 * jump: which packages are here, what is installed, and what exists upstream.
 * Deliberately does not fetch changelogs — interactive mode runs between this
 * and resolve(), and downloading notes for a package you then decline is waste.
 */
export function survey(cwd, only) {
  const { packageJsonPath, packages } = detect(cwd);

  if (only) {
    const known = new Set(packages.map((item) => item.name));
    for (const name of only) {
      if (!known.has(name)) {
        const found = [...known].join(', ') || 'none';
        throw new Error(`--only names ${name}, which is not a dependency here. Found: ${found}`);
      }
    }
  }

  const selected = only ? packages.filter((item) => only.includes(item.name)) : packages;

  return {
    packageJsonPath,
    entries: selected.map((entry) => ({
      ...entry,
      // Without an install, the declared range is the only reference point we
      // have; strip its operator so it can be compared.
      reference: entry.installedVersion ?? entry.declaredRange.replace(/^[^\d]*/, ''),
      versions: fetchAllVersions(entry.name, { cwd }),
    })),
  };
}

export function resolve(surveyed, targetSpec, cwd) {
  const packages = surveyed.entries.map((entry) => {
    const target = resolveTarget(targetSpec, entry.name);
    const targetVersion = selectTarget(entry.reference, entry.versions, target) ?? entry.reference;
    const latestVersion =
      selectTarget(entry.reference, entry.versions, 'latest') ?? entry.reference;

    const outdated = compareVersions(entry.reference, targetVersion) < 0;
    const heldBack = compareVersions(targetVersion, latestVersion) < 0;

    let entries = [];
    if (outdated) {
      const changelog = fetchChangelog(entry.name, targetVersion, { cwd });
      if (changelog) entries = sliceChangelog(changelog, entry.reference, targetVersion);
    }

    return {
      name: entry.name,
      declaredRange: entry.declaredRange,
      field: entry.field,
      installedVersion: entry.reference,
      targetVersion,
      latestVersion,
      target,
      jump: jumpClass(entry.reference, targetVersion),
      outdated,
      heldBack,
      entries,
    };
  });

  return { packageJsonPath: surveyed.packageJsonPath, packages, wrote: false };
}
```

- [ ] **Step 6: Teach `formatReport` about targets**

Inside `formatReport`, replace the loop body over `result.packages` with:

```js
for (const entry of result.packages) {
  const heldBackNote = entry.heldBack
    ? `    ${entry.latestVersion} is available, held back by --target ${entry.target}`
    : null;

  if (!entry.outdated) {
    lines.push(`  ${entry.name}  ${entry.installedVersion}  (up to date)`);
    if (heldBackNote) lines.push(heldBackNote);
    continue;
  }

  const breaking = entry.jump === 'major' || entry.entries.some(isBreaking);
  const label = breaking ? '  [breaking]' : '';
  lines.push(
    `  ${entry.name}  ${entry.installedVersion} → ${entry.targetVersion}  (${entry.jump})${label}`,
  );

  if (heldBackNote) lines.push(heldBackNote);

  if (entry.skipped) {
    lines.push(
      `    range "${entry.declaredRange}" is not a simple range — left unchanged, update it by hand`,
    );
  }

  for (const changelogEntry of entry.entries) {
    lines.push('', `    ── ${changelogEntry.version} ──`);
    for (const line of changelogEntry.body.split('\n')) lines.push(`    ${line}`);
  }

  if (entry.entries.length === 0) {
    lines.push('    (no changelog shipped in this version — see the repo for notes)');
  }

  lines.push('');
}
```

- [ ] **Step 7: Point `applyUpgrades` at the target version**

In `applyUpgrades`, change the `bumpRange` call from `entry.latestVersion` to `entry.targetVersion`:

```js
const newRange = bumpRange(entry.declaredRange, entry.targetVersion);
```

- [ ] **Step 8: Rewire `main`**

Replace the body of the `try` block inside `main` with:

```js
result = resolve(survey(args.cwd, args.only), args.targetSpec, args.cwd);
if (args.write) {
  applyUpgrades(result, args.cwd);
  result.wrote = true;
}
```

- [ ] **Step 9: Run the tests**

```bash
pnpm --filter @elirobinson/ai-patterns test
```

Expected: PASS — all previously passing tests plus the new ones.

- [ ] **Step 10: Verify against the scaffold template**

```bash
node packages/ai-patterns/src/resync/cli.mjs --cwd templates/default-app --target minor
node packages/ai-patterns/src/resync/cli.mjs --cwd templates/default-app --only tokens
node packages/ai-patterns/src/resync/cli.mjs --cwd templates/default-app --only nope; echo "exit: $?"
```

Expected: the first holds react inside `0.x` and notes the held-back version; the second reports tokens only; the third errors naming the packages that do exist and exits `1`.

- [ ] **Step 11: Commit**

```bash
git add packages/ai-patterns/src/resync/cli.mjs packages/ai-patterns/src/resync/cli.test.mjs
git commit -m "feat(ai-patterns): select packages and upgrade distance"
```

---

### Task 5: Interactive selection

**Files:**

- Create: `packages/ai-patterns/src/resync/prompt.mjs`
- Test: `packages/ai-patterns/src/resync/prompt.test.mjs`
- Modify: `packages/ai-patterns/src/resync/cli.mjs`

**Interfaces:**

- Consumes: `selectTarget` (Task 1), `TARGETS` (Task 2), the `entries` shape from `survey` (Task 4).
- Produces: `promptSelections(entries, {input, output}) => Promise<{only: string[], targetSpec: {fallback, byName}}>` — throws `Error` with message `interactive selection cancelled` on EOF.

  Consumed by `cli.mjs`. `main` becomes `async` as a result.

- [ ] **Step 1: Write the failing test**

`packages/ai-patterns/src/resync/prompt.test.mjs`:

```js
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { promptSelections } from './prompt.mjs';

const ENTRIES = [
  { name: '@elirobinson/react', reference: '1.0.2', versions: ['1.0.2', '1.4.0', '2.0.0'] },
  { name: '@elirobinson/tokens', reference: '0.2.0', versions: ['0.2.0', '0.3.0'] },
];

function channels(answers) {
  const written = [];
  return {
    input: Readable.from(answers.map((line) => `${line}\n`)),
    output: { write: (text) => written.push(text) },
    written,
  };
}

describe('promptSelections', () => {
  it('accepts every package at the default target', async () => {
    const { input, output } = channels(['y', '', 'y', '']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.only).toEqual(['@elirobinson/react', '@elirobinson/tokens']);
    expect(result.targetSpec.byName).toEqual({
      '@elirobinson/react': 'latest',
      '@elirobinson/tokens': 'latest',
    });
  });

  it('records a per-package target', async () => {
    const { input, output } = channels(['y', 'minor', 'n']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.only).toEqual(['@elirobinson/react']);
    expect(result.targetSpec.byName).toEqual({ '@elirobinson/react': 'minor' });
  });

  it('declining everything yields an empty selection', async () => {
    const { input, output } = channels(['n', 'n']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.only).toEqual([]);
  });

  it('treats a bare newline as no', async () => {
    const { input, output } = channels(['', '']);
    expect((await promptSelections(ENTRIES, { input, output })).only).toEqual([]);
  });

  it('re-asks on an unrecognised target rather than guessing', async () => {
    const { input, output } = channels(['y', 'sideways', 'minor', 'n']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.targetSpec.byName).toEqual({ '@elirobinson/react': 'minor' });
  });

  it('shows the version transition in the question', async () => {
    const { input, output, written } = channels(['n', 'n']);
    await promptSelections(ENTRIES, { input, output });

    expect(written.join('')).toContain('1.0.2');
    expect(written.join('')).toContain('2.0.0');
  });

  it('skips a package with nothing newer', async () => {
    const { input, output } = channels(['n']);
    const entries = [
      { name: '@elirobinson/react', reference: '2.0.0', versions: ['1.0.0', '2.0.0'] },
      { name: '@elirobinson/tokens', reference: '0.2.0', versions: ['0.2.0', '0.3.0'] },
    ];
    const result = await promptSelections(entries, { input, output });

    expect(result.only).toEqual([]);
  });

  it('throws when the input ends partway through', async () => {
    const { input, output } = channels(['y']);
    await expect(promptSelections(ENTRIES, { input, output })).rejects.toThrow(/cancelled/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @elirobinson/ai-patterns test prompt
```

Expected: FAIL — `Failed to resolve import "./prompt.mjs"`.

- [ ] **Step 3: Write the implementation**

`packages/ai-patterns/src/resync/prompt.mjs`:

```js
import { createInterface } from 'node:readline';
import { selectTarget } from './semver.mjs';
import { TARGETS } from './targets.mjs';

/**
 * Walks the outdated packages, asking whether to take each and how far. Reads
 * from an injected channel rather than process.stdin so the walk is testable
 * without a TTY.
 */
export async function promptSelections(entries, { input, output }) {
  const reader = createInterface({ input, terminal: false });
  const lines = reader[Symbol.asyncIterator]();

  async function ask(question) {
    output.write(question);
    const { value, done } = await lines.next();
    if (done) throw new Error('ds-resync: interactive selection cancelled');
    return String(value).trim();
  }

  const only = [];
  const byName = {};

  try {
    for (const entry of entries) {
      const latest = selectTarget(entry.reference, entry.versions, 'latest');
      // Nothing newer exists, so there is nothing to decide.
      if (latest === null || latest === entry.reference) continue;

      const answer = await ask(`Update ${entry.name} ${entry.reference} → ${latest}? [y/N] `);
      if (!/^y(es)?$/i.test(answer)) continue;

      let target = null;
      while (target === null) {
        const choice = await ask(`  How far? [${TARGETS.join('/')}] (latest) `);
        if (choice === '') target = 'latest';
        else if (TARGETS.includes(choice)) target = choice;
        else output.write(`  Not a target. Choose one of: ${TARGETS.join(', ')}\n`);
      }

      only.push(entry.name);
      byName[entry.name] = target;
    }
  } finally {
    reader.close();
  }

  return { only, targetSpec: { fallback: 'latest', byName } };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @elirobinson/ai-patterns test prompt
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Wire interactive mode into `main`**

In `packages/ai-patterns/src/resync/cli.mjs`, add the import:

```js
import { promptSelections } from './prompt.mjs';
```

Change `export function main(argv)` to `export async function main(argv)`, and replace the contents of its `try` block with:

```js
const surveyed = survey(args.cwd, args.only);

let targetSpec = args.targetSpec;
if (args.interactive) {
  if (!process.stdin.isTTY) {
    process.stderr.write(
      'ds-resync: --interactive needs a terminal. Use --only and --target instead.\n',
    );
    return 1;
  }

  const selection = await promptSelections(surveyed.entries, {
    input: process.stdin,
    output: process.stdout,
  });

  surveyed.entries = surveyed.entries.filter((entry) => selection.only.includes(entry.name));
  targetSpec = selection.targetSpec;
}

result = resolve(surveyed, targetSpec, args.cwd);
if (args.write) {
  applyUpgrades(result, args.cwd);
  result.wrote = true;
}
```

- [ ] **Step 6: Update the binary guard for the now-async main**

Replace the guard at the bottom of the file with:

```js
// Only run when invoked as a binary, so the module stays importable by tests.
if (process.argv[1] && process.argv[1].endsWith('cli.mjs')) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
```

The rejection handler is what turns a cancelled interactive walk into exit `1` with no write, since `promptSelections` throws rather than returning.

- [ ] **Step 7: Run the full suite**

```bash
pnpm --filter @elirobinson/ai-patterns test
```

Expected: PASS.

- [ ] **Step 8: Verify the non-TTY guard**

```bash
node packages/ai-patterns/src/resync/cli.mjs --cwd templates/default-app -i < /dev/null; echo "exit: $?"
```

Expected: the message about needing a terminal, exit `1`, and no change to `templates/default-app/package.json`. Confirm with:

```bash
git diff --stat templates/default-app/package.json
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add packages/ai-patterns/src/resync/prompt.mjs packages/ai-patterns/src/resync/prompt.test.mjs packages/ai-patterns/src/resync/cli.mjs
git commit -m "feat(ai-patterns): add interactive package selection"
```

---

### Task 6: Document the new flags

**Files:**

- Modify: `packages/ai-patterns/src/resync/SKILL.md`
- Modify: `docs/agents/ai-patterns.md`
- Create: `.changeset/ds-resync-selective.md`

**Interfaces:**

- Consumes: the flags from Tasks 4 and 5, and the `--json` fields from Task 4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Document the JSON fields in the skill**

In `packages/ai-patterns/src/resync/SKILL.md`, replace the bullet list under "It prints one record per `@elirobinson/*` dependency" with:

```markdown
- `installedVersion` / `targetVersion` / `latestVersion` — where the repo is, where this
  run would take it, and the newest thing published
- `target` — the distance requested for this package: `latest`, `minor`, or `patch`
- `heldBack` — true when `targetVersion` is below `latestVersion` because of `target`.
  A held-back package is not "current"; a newer version is waiting.
- `jump` — `major`, `minor`, `patch`, `prerelease`, or `none`. Below 1.0.0 a
  minor bump is reported as `major`, because these packages make no stability
  promise before 1.0.
- `entries` — the changelog entries the repo missed, newest first, each with a
  `version` and a `body`
- `skipped` — set when the declared range was too complex to rewrite safely
```

- [ ] **Step 2: Add a section on partial upgrades**

Insert this immediately before the `## 4. Migrate` heading in the same file:

````markdown
## 3b. When a major is too much right now

If a package has a breaking major the user is not ready for, they do not have to
skip the upgrade entirely. Take everything below it:

```bash
pnpm dlx @elirobinson/ai-patterns ds-resync --write --target react=minor
```
````

`--only react,tokens` restricts the run to named packages; the scope is optional.
`--target` accepts one distance for everything (`--target minor`) or per-package
assignments (`--target minor,react=latest`).

Offer this whenever the report shows a `major` jump the user hesitates over. Then
tell them what remains held back, so the deferred migration stays visible.

````

- [ ] **Step 3: Update the agent topic guide**

In `docs/agents/ai-patterns.md`, replace the `ds-resync` bullet with:

```markdown
- `ds-resync` (`packages/ai-patterns/src/resync/`) brings a consuming repo's `@elirobinson/*`
  deps up to date: `pnpm dlx @elirobinson/ai-patterns ds-resync` reports, `--write` applies.
  `--only` and `--target` narrow which packages move and how far; `-i` picks interactively.
  The agent-facing instructions ship at `@elirobinson/ai-patterns/resync/skill`.
````

- [ ] **Step 4: Add a changeset**

Create `.changeset/ds-resync-selective.md`:

```markdown
---
'@elirobinson/ai-patterns': minor
---

`ds-resync` can now upgrade a subset of packages, each to a chosen distance. `--only`
restricts the run to named packages, `--target` picks how far to jump (`latest`, `minor`,
or `patch`, globally or per package), and `-i` walks the choices interactively.

This exists for the case that actually blocks an upgrade: a breaking major you are not
ready for should not cost you the fixes below it. The report names any version held back
so the deferred migration stays visible.
```

- [ ] **Step 5: Run the full check suite**

```bash
pnpm --filter @elirobinson/ai-patterns test && pnpm lint && pnpm format:check
```

Expected: all pass.

- [ ] **Step 6: Commit and push**

```bash
git add packages/ai-patterns/src/resync/SKILL.md docs/agents/ai-patterns.md .changeset/ds-resync-selective.md
git commit -m "docs(ai-patterns): document ds-resync selective upgrade flags"
git push
```

---

## Notes on deviations from the spec

The spec named `prompt.mjs` as the only new module. This plan adds a second,
`targets.mjs`, holding the `--only` / `--target` vocabulary — normalisation, parsing, and
resolution. Keeping it out of `cli.mjs` holds that file to orchestration and gives the
parsing rules their own direct tests, which matters because the mixed form
(`--target minor,react=latest`) is the easiest part of this feature to get subtly wrong.

The spec described `inspect` gaining target awareness. This plan splits it into `survey`
and `resolve` instead. The split is what lets interactive selection run before any
changelog is downloaded — otherwise `-i` would fetch notes for every outdated package and
discard the ones you decline.
