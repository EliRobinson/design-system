import { describe, expect, it } from 'vitest';
import {
  BLOCK_BEGIN,
  BLOCK_END,
  BRAND_INDEX,
  referencePointer,
  renderIndexTable,
  replaceManagedBlock,
  transformBrandDocs,
} from './brand.mjs';

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

describe('transformBrandDocs', () => {
  const { readme, skill } = transformBrandDocs({
    readme: doc,
    skill: doc,
    referenceSkill: 'design-system-reference',
  });

  it('replaces the README inventory with what actually ships', () => {
    for (const entry of BRAND_INDEX) expect(readme).toContain(`\`${entry.path}\``);
  });

  it('does not advertise folders that were left out of the tarball', () => {
    for (const excluded of ['preview/', 'uploads/', 'slides/', 'templates/']) {
      expect(BRAND_INDEX.some((entry) => entry.path === excluded)).toBe(false);
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
