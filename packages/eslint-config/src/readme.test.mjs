/* `designSystem()`'s options were documented only in JSDoc, which a consumer
 * reads by opening node_modules. The README is now the reachable copy — so it
 * has to be in the tarball, and the one option that does not behave like the
 * others has to be in the README (#82).
 *
 * npm includes README.md whatever `files` says, which is precisely the kind of
 * implicit guarantee a later `files` edit is assumed to preserve. Pack for real
 * and read what came out.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PACKAGE_DIR = resolve(import.meta.dirname, '..');

describe('README', () => {
  it('ships in the tarball', () => {
    const [{ files }] = JSON.parse(
      execFileSync('npm', ['pack', '--dry-run', '--json'], {
        cwd: PACKAGE_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );

    expect(files.map((file) => file.path)).toContain('README.md');
    /* `npm pack` on a cold CI runner is well past vitest's 5s default —
       pack-integrity.test.mjs in ai-patterns budgets the same way. */
  }, 300_000);

  it('documents that copy.severity does not follow the top-level severity', () => {
    const readme = readFileSync(join(PACKAGE_DIR, 'README.md'), 'utf8');

    expect(readme).toContain("designSystem({ copy: { severity: 'error' } })");
    expect(readme).toMatch(/copy\.severity` is separate/);
  });
});
