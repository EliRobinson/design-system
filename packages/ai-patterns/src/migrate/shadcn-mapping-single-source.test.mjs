/* adopt/shadcn.md is the one shadcn → Miltinson mapping (#333).
 *
 * It is the copy consumers get, and the only copy migrate-files.test.mjs checks against
 * the manifest. A second table drifts the moment one of them changes: the contributor
 * table in docs/agents/components.md already disagreed with this one on Badge, Select,
 * Toaster and Separator when #333 removed it. So no other tracked Markdown file may hold
 * a table with a shadcn column. Link to adopt/shadcn.md instead.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { repoRoot } from '../artifacts/published-files.test-helper.mjs';

const SOURCE = 'packages/ai-patterns/src/migrate/adopt/shadcn.md';

/* Release notes quote history, and the vendored AI Elements source is not ours to edit. */
const isExempt = (path) =>
  path === SOURCE || path.endsWith('CHANGELOG.md') || path.startsWith('packages/ai-elements/src/');

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

const isDelimiterRow = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

/** Header rows of every Markdown table with a column that names shadcn, with line numbers. */
function shadcnTableHeaders(text) {
  const lines = text.split('\n');
  return lines.flatMap((line, index) =>
    line.includes('|') &&
    isDelimiterRow(lines[index + 1] ?? '') &&
    cells(line).some((cell) => /shadcn/i.test(cell))
      ? [{ line: index + 1, header: line.trim() }]
      : [],
  );
}

const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.md', '*.mdx'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);

describe('the shadcn mapping has one source', () => {
  it('finds a shadcn table the way the removed contributor table was written', () => {
    const removed = [
      '## shadcn → Miltinson mapping reference',
      '',
      '| shadcn component | Miltinson equivalent / notes |',
      '| ---------------- | ---------------------------- |',
      '| Badge            | `Badge`                      |',
    ].join('\n');
    expect(shadcnTableHeaders(removed)).toEqual([
      { line: 3, header: '| shadcn component | Miltinson equivalent / notes |' },
    ]);
    expect(shadcnTableHeaders('Use shadcn | not a table\n\nplain text')).toEqual([]);
  });

  it('reads the tracked Markdown, including the source itself', () => {
    expect(tracked).toContain(SOURCE);
    expect(shadcnTableHeaders(readFileSync(join(repoRoot, SOURCE), 'utf8'))).not.toEqual([]);
  });

  it(`keeps every shadcn mapping table in ${SOURCE}`, () => {
    const copies = tracked
      .filter((path) => !isExempt(path))
      .flatMap((path) =>
        shadcnTableHeaders(readFileSync(join(repoRoot, path), 'utf8')).map(
          ({ line, header }) => `${path}:${line}: ${header}`,
        ),
      );
    expect(copies, `link to ${SOURCE} instead of copying it`).toEqual([]);
  });
});
