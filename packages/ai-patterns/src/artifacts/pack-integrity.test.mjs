/* The invariant `dist/` cannot express: what is actually inside the tarball.
 *
 * `artifacts.json` and `brand-manifest.json` both record a path and a hash for
 * every file `ds-resync artifacts --write` will copy into a consuming repo, and
 * both are written by a walk of `dist/`. `npm pack` walks the same tree with a
 * different rule — it drops a symlink whose target is outside the package root
 * — so for symlinked entries the two disagreed silently: the manifests listed
 * thirteen font assets with valid hashes, the published package contained none
 * of them, and consumers got ENOENT from the first `ds-resync artifacts
 * --write` (#77). Nothing checkable in `dist/` differed.
 *
 * So this test packs for real and reads what came out. It generalises past the
 * fonts: any future mirrored asset is covered by the same two loops.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SKILL_DIRS } from './skills.mjs';

const PACKAGE_DIR = resolve(import.meta.dirname, '..', '..');

let extracted;
let scratch;
let artifacts;
let brandManifest;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Every path under `dir`, relative and forward-slashed, symlinks included. */
function walk(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(join(dir, entry.name), path));
    else found.push(path);
  }
  return found;
}

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'ai-patterns-pack-'));

  /* CI builds before it tests, and so does `pnpm build && pnpm test`. Building
     here when dist is absent keeps a cold checkout from failing on a missing
     file rather than on the invariant. */
  if (!existsSync(join(PACKAGE_DIR, 'dist', 'artifacts', 'artifacts.json'))) {
    execFileSync('node', ['scripts/build-artifacts.mjs'], { cwd: PACKAGE_DIR, stdio: 'ignore' });
  }

  /* `npm pack`, though releases go out through `pnpm publish`: pnpm has no
     `--ignore-scripts` for `pack`, so it always reruns `prepack`, and this test
     would then rewrite dist/ underneath whatever else `nx run-many -t
     build,test` has in flight — apps/docs reads this package's brand manifest.
     The two packers agree on the behaviour under test: both dropped the
     thirteen links before the fix and both carry the thirteen files after it,
     checked by hand against `pnpm pack` on the branch that added this. */
  execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', scratch], {
    cwd: PACKAGE_DIR,
    stdio: 'ignore',
  });

  const tarball = readdirSync(scratch).find((name) => name.endsWith('.tgz'));
  if (!tarball) throw new Error(`npm pack produced no tarball in ${scratch}`);

  execFileSync('tar', ['-xzf', join(scratch, tarball), '-C', scratch]);
  extracted = join(scratch, 'package', 'dist', 'artifacts');

  artifacts = JSON.parse(readFileSync(join(extracted, 'artifacts.json'), 'utf8'));
  brandManifest = JSON.parse(readFileSync(join(extracted, 'brand-manifest.json'), 'utf8'));
}, 300_000);

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

describe('the packed tarball', () => {
  it('holds every file artifacts.json lists, as a regular file with the recorded hash', () => {
    const missing = [];
    const mismatched = [];

    for (const file of artifacts.files) {
      const path = join(extracted, 'skills', file.path);
      if (!existsSync(path) || !lstatSync(path).isFile()) {
        missing.push(file.path);
        continue;
      }
      if (sha256(readFileSync(path)) !== file.hash) mismatched.push(file.path);
    }

    expect({ missing, mismatched }).toEqual({ missing: [], mismatched: [] });
  });

  it('holds every file the brand manifest marks ships: true', () => {
    const brandDir = join(extracted, 'skills', SKILL_DIRS.brand);

    const missing = brandManifest.artifacts
      .filter((artifact) => artifact.ships)
      .flatMap((artifact) => artifact.members.map((member) => member.path))
      .filter((path) => {
        const staged = join(brandDir, path);
        return !existsSync(staged) || !lstatSync(staged).isFile();
      });

    expect(missing).toEqual([]);
  });

  /* The regression itself, named. These are the only mirrored binaries in the
     shipped set, and they are the entries the two loops above would have caught
     had either existed when #77 shipped. */
  it('holds the mirrored font assets, which pack dropped as symlinks in 0.13.0–0.18.0', () => {
    const fonts = brandManifest.artifacts.filter((artifact) => artifact.group === 'fonts');
    const fontDir = join(extracted, 'skills', SKILL_DIRS.brand, 'fonts');

    expect(fonts.length).toBeGreaterThan(0);
    expect(readdirSync(fontDir).sort()).toEqual(
      fonts.map((artifact) => artifact.path.replace(/^fonts\//, '')).sort(),
    );
  });

  /* Belt to the braces above: a symlink anywhere in the packed tree is a file
     that resolved on the build machine and may not resolve on a consumer's. */
  it('contains no symlinks at all', () => {
    const links = walk(extracted).filter((path) =>
      lstatSync(join(extracted, path)).isSymbolicLink(),
    );

    expect(links).toEqual([]);
  });
});
