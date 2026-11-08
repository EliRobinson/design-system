/* Every name the migration patterns teach is one the packages ship (#322).
 *
 * The pattern files are what an agent copies from when it moves a site onto the system,
 * so a renamed prop, a moved component or a dropped token has to fail here, not in a
 * consumer's build after they followed the file. See snippets.test-helper.mjs for the
 * fence and table convention this relies on.
 */

import { readFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  backticked,
  checkAfterBlock,
  checkJsx,
  checkMappingSpan,
  checkUtilities,
  EXEMPT_LANGUAGES,
  fencedBlocks,
  loadVocabulary,
  migrateFiles,
  nearestOnScale,
  SIDES,
  tables,
} from './snippets.test-helper.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const files = migrateFiles(here);
const ADOPT_SOURCES = ['bootstrap', 'mui', 'plain-css', 'shadcn', 'tailwind'];
/* Table columns whose backticked spans are ours, so are checked. */
const CHECKED_COLUMNS = ['Miltinson', 'HTML classes'];

let vocab;
beforeAll(() => {
  vocab = loadVocabulary();
});

describe('the file set', () => {
  it('has one adopt pattern per source the issue names', () => {
    const adopt = files
      .map((file) => relative(here, file))
      .filter((file) => file.startsWith('adopt/'))
      .map((file) => file.slice('adopt/'.length, -'.md'.length));
    expect(adopt.sort()).toEqual(ADOPT_SOURCES);
  });

  it.each(ADOPT_SOURCES)('adopt/%s.md covers every axis and has before/after code', (source) => {
    const text = readFileSync(`${here}/adopt/${source}.md`, 'utf8');
    for (const heading of ['Colour', 'Type', 'Spacing', 'Radius', 'Shadow', 'Components']) {
      expect(text, `missing "## ${heading}"`).toMatch(new RegExp(`^## ${heading}`, 'm'));
    }
    const sides = new Set(fencedBlocks(text).map((block) => block.side));
    expect(sides).toContain('before');
    expect(sides).toContain('after');
  });
});

describe.each(files.map((file) => [relative(here, file), file]))('%s', (_name, file) => {
  const text = readFileSync(file, 'utf8');
  const blocks = fencedBlocks(text);

  it('labels every code block before or after', () => {
    const unlabelled = blocks
      .filter((block) => !EXEMPT_LANGUAGES.has(block.lang) && !SIDES.has(block.side))
      .map((block) => `line ${block.line}: \`\`\`${block.lang} ${block.side ?? ''}`);
    expect(unlabelled).toEqual([]);
  });

  it('names only shipped components, props, tokens and classes in after blocks', () => {
    const problems = blocks
      .filter((block) => block.side === 'after')
      .flatMap((block) => checkAfterBlock(block, vocab).map((p) => `line ${block.line}: ${p}`));
    expect(problems).toEqual([]);
  });

  it('names only shipped things in the Miltinson columns of every mapping table', () => {
    const problems = [];
    for (const table of tables(text)) {
      const columns = table.header
        .map((name, index) => (CHECKED_COLUMNS.includes(name) ? index : -1))
        .filter((index) => index !== -1);
      for (const row of table.rows) {
        for (const span of columns.flatMap((column) => backticked(row.cells[column] ?? ''))) {
          problems.push(...checkMappingSpan(span, vocab).map((p) => `line ${row.line}: ${p}`));
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('maps each scale value to the nearest token on that scale', () => {
    const problems = [];
    for (const table of tables(text)) {
      const ours = table.header.indexOf('Miltinson');
      const source = table.header.indexOf('Source px');
      if (ours === -1 || source === -1) continue;
      for (const row of table.rows) {
        const sourcePx = Number(row.cells[source]);
        const [token] = backticked(row.cells[ours]).filter((span) => span.startsWith('--'));
        if (!token || Number.isNaN(sourcePx)) {
          problems.push(`line ${row.line}: a scale row needs a number and one token`);
          continue;
        }
        const nearest = nearestOnScale(token, sourcePx, vocab);
        if (!nearest.includes(token)) {
          problems.push(
            `line ${row.line}: ${sourcePx}px is nearest ${nearest.join(' or ')}, not ${token}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

/* The checker is the whole guarantee, so it has to be shown to fail. Each case is a
   rename or a typo an agent would otherwise copy into a consumer's app. */
describe('the checker catches drift', () => {
  const jsx = (code) => checkJsx(code, vocab);
  const BUTTON = "import { Button } from '@elirobinson/react/components/atoms/Button';\n";

  it('passes a correct block', () => {
    expect(
      jsx(`${BUTTON}export const a = <Button variant="accent" size="sm">Save</Button>;`),
    ).toEqual([]);
  });

  it('fails a moved component subpath', () => {
    const code =
      "import { Button } from '@elirobinson/react/components/molecules/Button';\nexport const a = <Button>Go</Button>;";
    expect(jsx(code).join('\n')).toMatch(/not a component subpath/);
  });

  it('fails a removed export', () => {
    const code =
      "import { CardBody } from '@elirobinson/react/components/molecules/Card';\nexport const a = <CardBody />;";
    expect(jsx(code).join('\n')).toMatch(/does not export CardBody/);
  });

  it('fails an unknown prop and an unknown variant value', () => {
    expect(
      jsx(`${BUTTON}export const a = <Button intent="accent">Go</Button>;`).join('\n'),
    ).toMatch(/no prop "intent"/);
    expect(
      jsx(`${BUTTON}export const a = <Button variant="outline">Go</Button>;`).join('\n'),
    ).toMatch(/not one of/);
  });

  it('fails a missing required prop', () => {
    const code =
      'import { Input } from \'@elirobinson/react/components/atoms/Input\';\nexport const a = <Input name="email" />;';
    expect(jsx(code).join('\n')).toMatch(/missing required prop "label"/);
  });

  it('fails an undeclared token and a Tailwind colour the bridge does not map', () => {
    expect(
      jsx(`export const a = <p style={{ color: 'var(--fg-primary)' }}>x</p>;`).join('\n'),
    ).toMatch(/--fg-primary/);
    expect(checkUtilities('bg-brand text-sm', vocab).join('\n')).toMatch(/no colour "brand"/);
  });

  it('runs the shipped lint rule over the block', () => {
    expect(jsx('export const a = <p className="text-zinc-500">x</p>;').join('\n')).toMatch(
      /no-hardcoded-design-values/,
    );
  });

  it('fails a ds-* class no stylesheet ships', () => {
    expect(checkUtilities('ds-button ds-button--outline', vocab).join('\n')).toMatch(
      /ds-button--outline/,
    );
  });

  it('fails a scale row that is no longer the nearest token', () => {
    expect(nearestOnScale('--space-4', 16, vocab)).toEqual(['--space-4']);
    expect(nearestOnScale('--space-4', 24, vocab)).not.toContain('--space-4');
  });
});
