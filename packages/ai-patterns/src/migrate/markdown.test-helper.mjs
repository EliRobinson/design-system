/* Markdown parsing shared by the suites that read Markdown as data: migrate-files.test.mjs
 * (the migration pattern files) and scripts/shadcn-mapping-single-source.test.mjs (every
 * tracked Markdown file, #333). One definition of "a table" so the two cannot drift.
 *
 * Not a published module: the `.test-helper.mjs` suffix is outside both Vitest's include
 * glob and this package's `files`. It imports nothing, so a suite outside this package
 * can load it without the package's dependencies.
 */

/* Indented fences count: a code block inside a numbered step is still copied. */
const FENCE = /^( *)```([^\n]*)\n([\s\S]*?)^\1```$/gm;

/** @returns {{ lang: string, side: string | null, code: string, line: number }[]} */
export function fencedBlocks(markdown) {
  const blocks = [];
  for (const match of markdown.matchAll(FENCE)) {
    const [, indent, info, body] = match;
    const [lang = '', side = null] = info.trim().split(/\s+/);
    const line = markdown.slice(0, match.index).split('\n').length;
    const code = body.replace(new RegExp(`^${indent}`, 'gm'), '');
    blocks.push({ lang, side, code, line });
  }
  return blocks;
}

/* Blanked, not removed, so every line number after a fence still points at the file. */
function stripFences(markdown) {
  return markdown.replace(FENCE, (fence) => fence.replace(/[^\n]/g, ''));
}

function cells(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

/** Every Markdown table outside a code fence, as header + rows of cells, with line numbers. */
export function tables(markdown) {
  const found = [];
  const lines = stripFences(markdown).split('\n');
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].trim().startsWith('|') || !/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) continue;
    const header = cells(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith('|')) {
      rows.push({ cells: cells(lines[j]), line: j + 1 });
      j += 1;
    }
    found.push({ header, headerLine: i + 1, rows });
    i = j;
  }
  return found;
}

export function backticked(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}
