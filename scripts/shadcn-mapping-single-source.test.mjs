/* packages/ai-patterns/src/migrate/adopt/shadcn.md is the one shadcn → Miltinson
 * mapping (#333).
 *
 * It is the copy consumers get, and the only copy migrate-files.test.mjs checks against
 * the manifest. A second table drifts as soon as one of them changes: the contributor
 * table in docs/agents/components.md already disagreed with it on Badge, Select, Toaster
 * and Separator when #333 removed it.
 *
 * The check is a keyword tripwire, not a parser of intent: no tracked Markdown file but
 * the source may hold a table with a column header that names shadcn. A mapping written
 * as a list, or under a header that never says shadcn, gets through. Link to the source
 * instead of copying it.
 *
 * It lives here, not in ai-patterns, because it reads every Markdown file in the repo.
 * As an ai-patterns input that would rerun the whole package suite on any doc edit.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { tables } from '../packages/ai-patterns/src/migrate/markdown.test-helper.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'packages/ai-patterns/src/migrate/adopt/shadcn.md';

/* Release notes quote history, and the vendored AI Elements source is not ours to edit. */
const isExempt = (path) =>
  path === SOURCE || path.endsWith('CHANGELOG.md') || path.startsWith('packages/ai-elements/src/');

const shadcnTables = (markdown) =>
  tables(markdown).filter((table) => table.header.some((cell) => /shadcn/i.test(cell)));

const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.md', '*.mdx'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

describe('the shadcn mapping has one source', () => {
  it('finds a table shaped like the one #333 removed, and none inside a code fence', () => {
    const removed = [
      '## shadcn → Miltinson mapping reference',
      '',
      '| shadcn component | Miltinson equivalent / notes |',
      '|-|-|',
      '| Badge | `Badge` |',
    ].join('\n');
    expect(shadcnTables(removed).map((table) => table.headerLine)).toEqual([3]);

    const fenced = ['```md', '| shadcn | Miltinson |', '| --- | --- |', '```'].join('\n');
    expect(shadcnTables(fenced)).toEqual([]);
  });

  it('reads the tracked Markdown, including the source itself', () => {
    expect(tracked).toContain(SOURCE);
    expect(shadcnTables(readFileSync(join(repoRoot, SOURCE), 'utf8'))).not.toEqual([]);
  });

  it(`keeps every table with a shadcn column in ${SOURCE}`, () => {
    const copies = tracked
      .filter((path) => !isExempt(path))
      .flatMap((path) =>
        shadcnTables(readFileSync(join(repoRoot, path), 'utf8')).map(
          (table) => `${path}:${table.headerLine}: | ${table.header.join(' | ')} |`,
        ),
      );
    expect(copies, `link to ${SOURCE} instead of copying it`).toEqual([]);
  });
});
