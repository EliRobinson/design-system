import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  BLOCK_BEGIN,
  BLOCK_END,
  BRAND_DESCRIPTIONS,
  brandIndex,
  indexPathFor,
  referencePointer,
  renderIndexTable,
  replaceManagedBlock,
  transformBrandDocs,
} from './brand.mjs';
import { BRAND_SOURCES } from './brand-manifest.mjs';

const brandRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
  'design-system-docs',
);

/* An independent walk of the real folder — the tarball is a copy of these
   paths, so this is the shipped file list the packer hands transformBrandDocs.
   Nothing is shared with the packer, so the coverage assertion is double-entry
   rather than an echo. */
function everyPath(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...everyPath(join(dir, entry.name), path));
    else found.push(path);
  }
  return found;
}

const shipped = [
  ...BRAND_SOURCES.flatMap((entry) => {
    try {
      return everyPath(join(brandRoot, entry), entry);
    } catch {
      return [entry]; // a file, not a directory
    }
  }),
  'README.md',
  'SKILL.md',
];

const doc = `# Title

before

${BLOCK_BEGIN}

in-repo prose that a consumer must not receive

${BLOCK_END}

after
`;

describe('replaceManagedBlock', () => {
  it('swaps the block and leaves everything around it alone', () => {
    const out = replaceManagedBlock(doc, 'consumer prose');
    expect(out).toContain('before');
    expect(out).toContain('after');
    expect(out).toContain('consumer prose');
    expect(out).not.toContain('in-repo prose');
  });

  it('keeps the markers so the next run can find them again', () => {
    const out = replaceManagedBlock(doc, 'consumer prose');
    expect(out).toContain(BLOCK_BEGIN);
    expect(out).toContain(BLOCK_END);
    expect(replaceManagedBlock(out, 'second pass')).toContain('second pass');
  });

  it('fails loudly rather than shipping the in-repo prose when the markers are gone', () => {
    expect(() => replaceManagedBlock('# Title\n\nno markers here\n', 'x', 'README.md')).toThrow(
      /README\.md has no/,
    );
  });

  it('fails when the markers are the wrong way round', () => {
    expect(() => replaceManagedBlock(`${BLOCK_END}\n${BLOCK_BEGIN}`, 'x')).toThrow(/has no/);
  });
});

describe('renderIndexTable', () => {
  it('renders one row per shipped path', () => {
    const table = renderIndexTable([{ path: 'assets/', description: 'Logos.' }]);
    expect(table).toContain('| `assets/`');
    expect(table).toContain('Logos.');
    expect(table.split('\n')).toHaveLength(3);
  });
});

describe('referencePointer', () => {
  it('names the sibling skill rather than a URL', () => {
    const text = referencePointer('design-system-reference');
    expect(text).toContain('.claude/skills/design-system-reference/');
    expect(text).not.toMatch(/https?:\/\//);
  });
});

describe('indexPathFor', () => {
  it('groups a nested file under its own folder, not its top-level segment', () => {
    expect(indexPathFor('ui_kits/_shared/Primitives.jsx')).toBe('ui_kits/_shared/');
    expect(indexPathFor('ui_kits/marketing/index.html')).toBe('ui_kits/marketing/');
    expect(indexPathFor('fonts/geist-latin-wght-normal.woff2')).toBe('fonts/');
  });

  it('leaves a top-level file as its own row', () => {
    expect(indexPathFor('colors_and_type.css')).toBe('colors_and_type.css');
    expect(indexPathFor('README.md')).toBe('README.md');
  });
});

describe('brandIndex', () => {
  it('describes every file the brand skill actually ships', () => {
    expect(() => brandIndex(shipped)).not.toThrow();
  });

  it('covers ui_kits/_shared/, which the four kit rows used to mask', () => {
    expect(shipped).toContain('ui_kits/_shared/Primitives.jsx');
    expect(brandIndex(shipped).map((entry) => entry.path)).toContain('ui_kits/_shared/');
  });

  /* The regression this whole check exists for: a sibling folder under an
     already-described parent shipped silently, because the old check compared
     `path.split('/')[0]` and `ui_kits` was covered four times over. */
  it('fails on a shipped folder no row describes, however deep it sits', () => {
    expect(() => brandIndex([...shipped, 'ui_kits/_drafts/Sketch.jsx'])).toThrow(
      /ships ui_kits\/_drafts\/, which BRAND_DESCRIPTIONS .* does not describe/s,
    );
    expect(() => brandIndex([...shipped, 'assets/icons/star.svg'])).toThrow(
      /ships assets\/icons\//,
    );
  });

  it('fails on a row nothing backs, so the table cannot outlive the files', () => {
    expect(() =>
      brandIndex(shipped.filter((path) => !path.startsWith('ui_kits/_shared/'))),
    ).toThrow(/describes ui_kits\/_shared\/, which the brand skill does not ship/);
  });

  it('fails rather than emit an empty inventory when nothing was staged', () => {
    expect(() => brandIndex([])).toThrow(/staged no files/);
  });
});

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

describe('transformBrandDocs', () => {
  const { readme, skill } = transformBrandDocs({
    readme: doc,
    skill: doc,
    referenceSkill: 'design-system-reference',
    shipped,
  });

  it('replaces the README inventory with what actually ships', () => {
    for (const path of Object.keys(BRAND_DESCRIPTIONS)) expect(readme).toContain(`\`${path}\``);
    expect(readme).toContain('`ui_kits/_shared/`');
    expect(skill).toContain('`ui_kits/_shared/`');
  });

  it('does not advertise folders that were left out of the tarball', () => {
    for (const excluded of ['preview/', 'uploads/', 'slides/', 'patterns/']) {
      expect(Object.keys(BRAND_DESCRIPTIONS)).not.toContain(excluded);
    }
    expect(readme).not.toContain('`preview/`');
    expect(readme).not.toContain('`uploads/`');
  });

  it('repoints the skill at the sibling reference instead of the undeployed docs site', () => {
    expect(skill).toContain('.claude/skills/design-system-reference/');
    expect(skill).toContain('pnpm ds props');
    expect(skill).not.toContain('in-repo prose');
  });
});
