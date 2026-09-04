#!/usr/bin/env node
/**
 * `pnpm sync:elements` — re-pull vendored AI Elements source and report drift.
 *
 * The vendored copy in `packages/ai-elements/src/` is upstream's, transformed by
 * `ai-elements-transforms.mjs` and by nothing else. That single fact is what
 * this script exploits: it re-derives the expected vendored bytes from fresh
 * upstream bytes, so every difference it finds is attributable.
 *
 *   upstream changed, we did not edit   -> a reviewable diff, applied by --write
 *   we edited, upstream did not         -> reported, left alone
 *   both                                -> CONFLICT, exit 2, nothing written
 *
 * Without the third case a re-sync silently reverts local work, or silently
 * keeps a stale file forever. That is the rot this exists to prevent.
 *
 * Modes:
 *   pnpm sync:elements                 check against the newest upstream release
 *   pnpm sync:elements --write         vendor/update and re-pin the lockfile
 *   pnpm sync:elements --ref <tag|sha> target a specific upstream ref
 *   pnpm sync:elements --pinned        check against the pinned ref only
 *   pnpm sync:elements --force         with --write, overwrite locally edited files
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveWorkspaceSpecifier, vendor } from './ai-elements-transforms.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(root, 'packages', 'ai-elements');
const lockPath = join(packageRoot, 'elements.lock.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};

const shouldWrite = flag('--write');
const force = flag('--force');
const pinnedOnly = flag('--pinned');
const requestedRef = option('--ref');

const REPO = 'vercel/ai-elements';
const RELEASE_TAG_RE = /^ai-elements@(\d+)\.(\d+)\.(\d+)$/;
const ELEMENT_SOURCE_RE = /^packages\/elements\/src\/[a-z0-9-]+\.tsx$/;
const UPSTREAM_MANIFEST = 'packages/elements/package.json';
const WORKSPACE_ALIAS_RE = /(?:\bfrom\s*|\bimport\s*)["'](@repo\/shadcn-ui\/[^"'\n]+)["']/g;

const sha256 = (text) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

async function github(path) {
  const headers = { accept: 'application/vnd.github+json' };

  // Anonymous GitHub API is 60 requests/hour. This script makes three, so it
  // works unauthenticated; the token is picked up when one happens to be around
  // (CI, `gh auth`) purely to stay clear of that ceiling on a shared runner IP.
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${path}: ${await response.text()}`);
  }

  return response.json();
}

async function raw(commit, path) {
  const response = await fetch(`https://raw.githubusercontent.com/${REPO}/${commit}/${path}`);

  if (!response.ok) {
    throw new Error(`Upstream fetch failed (${response.status}) for ${path} at ${commit}`);
  }

  return response.text();
}

/**
 * Newest `ai-elements@x.y.z` tag, by semver rather than by list order — the
 * tags endpoint orders by creation, which puts a patch on an old line first.
 */
async function newestReleaseRef() {
  const tags = await github('tags?per_page=100');
  const releases = tags
    .map((tag) => ({ tag, match: RELEASE_TAG_RE.exec(tag.name) }))
    .filter(({ match }) => match !== null)
    .sort((a, b) => {
      for (let index = 1; index <= 3; index += 1) {
        const delta = Number(b.match[index]) - Number(a.match[index]);
        if (delta !== 0) {
          return delta;
        }
      }
      return 0;
    });

  if (releases.length === 0) {
    throw new Error(`No ai-elements@x.y.z tags found on ${REPO}`);
  }

  return releases[0].tag.name;
}

async function resolveRef(ref) {
  const commit = await github(`commits/${encodeURIComponent(ref)}`);
  return { repo: REPO, ref, commit: commit.sha, committedAt: commit.commit.committer.date };
}

/**
 * Every file we vendor at `commit`: the elements themselves, plus the transitive
 * closure of the shadcn/ui primitives they import. Walking the closure rather
 * than carrying a hand-written list is the point — upstream adds a primitive
 * import and the next `--write` picks it up instead of failing to resolve it.
 */
async function collectUpstream(commit) {
  const tree = await github(`git/trees/${commit}?recursive=1`);

  if (tree.truncated) {
    throw new Error(`Upstream tree at ${commit} was truncated; cannot enumerate reliably.`);
  }

  const available = new Set(
    tree.tree.filter((entry) => entry.type === 'blob').map((entry) => entry.path),
  );
  const sources = new Map();
  const queue = [...available].filter((path) => ELEMENT_SOURCE_RE.test(path)).sort();

  if (queue.length === 0) {
    throw new Error(`No element sources under packages/elements/src at ${commit}.`);
  }

  while (queue.length > 0) {
    const path = queue.shift();

    if (sources.has(path)) {
      continue;
    }

    const source = await raw(commit, path);
    sources.set(path, source);

    for (const [, specifier] of source.matchAll(WORKSPACE_ALIAS_RE)) {
      const resolved = resolveWorkspaceSpecifier(specifier, available);

      if (!resolved) {
        throw new Error(`${path} imports "${specifier}", which does not exist at ${commit}.`);
      }

      if (!sources.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return sources;
}

/** Minimal line-level unified diff. Enough to review a vendored bump by eye. */
function unifiedDiff(before, after, label) {
  const a = before.split('\n');
  const b = after.split('\n');
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push(`-${a[i]}`);
      i += 1;
    } else {
      lines.push(`+${b[j]}`);
      j += 1;
    }
  }

  while (i < a.length) {
    lines.push(`-${a[i]}`);
    i += 1;
  }
  while (j < b.length) {
    lines.push(`+${b[j]}`);
    j += 1;
  }

  // Context-collapsed: a full listing of a 900-line component buries the change.
  const changed = lines.map((line) => line[0] !== ' ');
  const keep = lines.map((_, index) =>
    changed.slice(Math.max(0, index - 3), index + 4).some(Boolean),
  );

  const out = [`--- a/${label}`, `+++ b/${label}`];
  let elided = false;

  for (const [index, line] of lines.entries()) {
    if (keep[index]) {
      if (elided) {
        out.push('@@');
        elided = false;
      }
      out.push(line);
    } else {
      elided = true;
    }
  }

  return out.join('\n');
}

function readLock() {
  if (!existsSync(lockPath)) {
    throw new Error(
      `${lockPath} is missing. Bootstrap the vendored source with:\n` +
        '  pnpm sync:elements --write --ref ai-elements@<x.y.z>',
    );
  }

  return JSON.parse(readFileSync(lockPath, 'utf8'));
}

function readVendored(target) {
  const path = join(packageRoot, target);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function listVendored() {
  const targets = [];

  for (const dir of ['src/components', 'src/ui', 'src/lib', 'src/hooks']) {
    const full = join(packageRoot, dir);

    if (!existsSync(full)) {
      continue;
    }

    for (const entry of readdirSync(full)) {
      targets.push(`${dir}/${entry}`);
    }
  }

  return targets;
}

const lock = readLock();
const pinned = lock.upstream;
const targetRefName = requestedRef ?? (pinnedOnly ? pinned.ref : await newestReleaseRef());
const target = await resolveRef(targetRefName);

console.log(`sync:elements: pinned  ${pinned.repo} ${pinned.ref} (${pinned.commit.slice(0, 12)})`);
console.log(
  `sync:elements: target  ${target.repo} ${target.ref} (${target.commit.slice(0, 12)}, ${target.committedAt})`,
);

const upstreamSources = await collectUpstream(target.commit);
const upstreamPaths = new Set(upstreamSources.keys());
const upstreamManifest = JSON.parse(await raw(target.commit, UPSTREAM_MANIFEST));

const conflicts = [];
const upstreamChanges = [];
const localEdits = [];
const added = [];
const missing = [];
const headerRefresh = [];
const nextFiles = {};

for (const [upstreamPath, source] of [...upstreamSources].sort()) {
  const { target: vendorTarget, content } = vendor({
    upstreamPath,
    source,
    upstream: target,
    upstreamPaths,
  });

  const upstreamDigest = sha256(source);
  const expectedDigest = sha256(content);
  const record = lock.files[vendorTarget];
  const onDisk = readVendored(vendorTarget);

  nextFiles[vendorTarget] = {
    from: upstreamPath,
    upstream: upstreamDigest,
    vendored: expectedDigest,
  };

  if (!record) {
    added.push({ vendorTarget, upstreamPath, content });
    continue;
  }

  if (onDisk === null) {
    missing.push({ vendorTarget, content });
    continue;
  }

  const upstreamChanged = record.upstream !== upstreamDigest;
  // A file byte-identical to what the transform layer produces right now is not
  // a local edit, whatever the lockfile last recorded — it IS the pipeline's own
  // output, and the recorded digest is merely behind, because a rule was added
  // to scripts/ai-elements-transforms.mjs since the last re-pin. Without this,
  // adding a rule makes every file that rule does not touch report as LOCAL EDIT
  // permanently: the branch below deliberately keeps the stale digest, so the
  // divergence can never be re-baselined, and `--force` does not reach it either
  // (it only overrides CONFLICT).
  //
  // The guard is unchanged for a real hand edit. Those bytes are not what the
  // transform layer produces, so they still report and still keep their recorded
  // digest.
  const locallyEdited = sha256(onDisk) !== record.vendored && sha256(onDisk) !== expectedDigest;

  if (upstreamChanged && locallyEdited) {
    conflicts.push({ vendorTarget, upstreamPath, onDisk, content });
  } else if (upstreamChanged) {
    upstreamChanges.push({ vendorTarget, upstreamPath, onDisk, content });
  } else if (locallyEdited) {
    localEdits.push({ vendorTarget, onDisk, content });
    // Keep the recorded digest: the edit is the divergence we want reported next
    // run too, not a new baseline this run quietly adopts.
    nextFiles[vendorTarget].vendored = record.vendored;
  } else if (sha256(onDisk) !== expectedDigest) {
    // Upstream bytes identical and no local edit, yet the expected content moved:
    // the only part of a vendored file not derived from those bytes is the
    // release name in its header, so this is a re-pin with no code change.
    // It still has to be written. Skip it and the file keeps naming the old
    // release while the lockfile names the new one, and — because the lockfile
    // would record the digest of content that was never written — all 73
    // untouched files report as LOCAL EDIT on the very next run.
    headerRefresh.push({ vendorTarget, content });
  }
}

const removed = listVendored().filter((vendorTarget) => !nextFiles[vendorTarget]);

const dependencyDrift = Object.entries(upstreamManifest.dependencies ?? {}).filter(
  ([name, range]) => (lock.upstreamDependencies ?? {})[name] !== range,
);

for (const { vendorTarget } of localEdits) {
  console.log(`\nLOCAL EDIT   ${vendorTarget} (upstream unchanged — kept)`);
}

for (const { vendorTarget, onDisk, content } of upstreamChanges) {
  console.log(`\nUPSTREAM     ${vendorTarget}`);
  console.log(unifiedDiff(onDisk, content, vendorTarget));
}

for (const { vendorTarget, onDisk, content } of conflicts) {
  console.error(`\nCONFLICT     ${vendorTarget}`);
  console.error(unifiedDiff(onDisk, content, vendorTarget));
}

for (const { vendorTarget, upstreamPath } of added) {
  console.log(`\nADDED        ${vendorTarget}  (upstream ${upstreamPath})`);
}

for (const vendorTarget of removed) {
  console.log(`\nREMOVED      ${vendorTarget}  (no longer in upstream)`);
}

for (const [name, range] of dependencyDrift) {
  console.log(
    `\nDEP          ${name}: ${(lock.upstreamDependencies ?? {})[name] ?? '(absent)'} -> ${range}`,
  );
}

if (headerRefresh.length > 0) {
  console.log(
    `\nHEADER       ${headerRefresh.length} file(s) unchanged upstream, provenance header names the old release`,
  );
}

const drifted =
  upstreamChanges.length +
    added.length +
    removed.length +
    missing.length +
    headerRefresh.length +
    dependencyDrift.length >
    0 || pinned.commit !== target.commit;

if (conflicts.length > 0 && !force) {
  console.error(
    `\nsync:elements: ${conflicts.length} file(s) changed upstream AND locally. Nothing written.\n` +
      'Reconcile each one, then re-run. `--force` overwrites local edits and is a last resort:\n' +
      'the modification layer belongs in scripts/ai-elements-transforms.mjs, not in a vendored file.',
  );
  process.exit(2);
}

if (!shouldWrite) {
  if (!drifted && localEdits.length === 0) {
    console.log('\nsync:elements: vendored source matches the pinned upstream release.');
    process.exit(0);
  }

  console.log(
    '\nsync:elements: upstream has moved. Re-run with --write to vendor it and re-pin the lockfile.',
  );
  process.exit(drifted ? 1 : 0);
}

const writes = [
  ...added,
  ...missing,
  ...upstreamChanges,
  ...headerRefresh,
  ...(force ? conflicts : []),
];

for (const { vendorTarget, content } of writes) {
  const path = join(packageRoot, vendorTarget);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`sync:elements: wrote ${vendorTarget}`);
}

for (const vendorTarget of removed) {
  rmSync(join(packageRoot, vendorTarget));
  console.log(`sync:elements: removed ${vendorTarget}`);
}

if (force) {
  for (const { vendorTarget } of conflicts) {
    nextFiles[vendorTarget].vendored = sha256(
      writes.find((write) => write.vendorTarget === vendorTarget).content,
    );
  }
}

writeFileSync(
  lockPath,
  `${JSON.stringify(
    {
      refreshWith: 'pnpm sync:elements --write',
      upstream: {
        repo: target.repo,
        ref: target.ref,
        commit: target.commit,
        committedAt: target.committedAt,
        license: 'Apache-2.0',
      },
      upstreamDependencies: upstreamManifest.dependencies ?? {},
      files: Object.fromEntries(Object.entries(nextFiles).sort(([a], [b]) => a.localeCompare(b))),
    },
    null,
    2,
  )}\n`,
);

console.log(
  `\nsync:elements: pinned to ${target.ref} (${target.commit.slice(0, 12)}), ${Object.keys(nextFiles).length} files vendored.`,
);
