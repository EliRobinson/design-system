import { describe, expect, it } from 'vitest';

import { validatePack, VOICE_SECTIONS } from './schema.mjs';

const minimal = () => ({
  id: 'example',
  label: 'Example',
  person: { guidance: 'g', anchors: { asPerson: 'p', asCompany: 'c' } },
  tone: [{ name: 'Practical', gloss: 'g' }],
  casing: ['c'],
  words: { use: ['build'], avoid: ['synergy'] },
  emoji: { guidance: 'g', allowed: ['✓'] },
  anchors: ['a'],
  taglines: ['t'],
});

describe('VOICE_SECTIONS', () => {
  it('marks every section product-level until #159 question 1 is decided', () => {
    expect(VOICE_SECTIONS.every((section) => section.level === 'product')).toBe(true);
  });

  it('has no duplicate keys', () => {
    const keys = VOICE_SECTIONS.map((section) => section.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('validatePack', () => {
  it('returns a valid pack', () => {
    const pack = minimal();
    expect(validatePack(pack)).toBe(pack);
  });

  it('names the missing field rather than failing generically', () => {
    const pack = minimal();
    delete pack.words;
    expect(() => validatePack(pack)).toThrow(/words/);
  });

  it('names a nested missing field by its path', () => {
    const pack = minimal();
    delete pack.words.avoid;
    expect(() => validatePack(pack)).toThrow(/words\.avoid/);
  });

  it('rejects an empty enumeration, which is almost always a bad merge', () => {
    const pack = minimal();
    pack.words.use = [];
    expect(() => validatePack(pack)).toThrow(/words\.use/);
  });

  it('ignores unknown fields so an older schema is not broken by a newer pack', () => {
    const pack = { ...minimal(), somethingNewer: true };
    expect(() => validatePack(pack)).not.toThrow();
  });

  it('requires an id and a label, which name the pack in every rendered output', () => {
    const pack = minimal();
    delete pack.id;
    expect(() => validatePack(pack)).toThrow(/id/);
  });
});
