import { describe, expect, it } from 'vitest';

import { grepFor, missingShots } from './visual-missing.mjs';

const shot = (over) => ({
  project: 'storybook-wide',
  title: 'components-button--primary · light',
  route: null,
  storyId: 'components-button--primary',
  theme: 'light',
  baselinePath: 'tests/visual/__screenshots__/a.png',
  ...over,
});

describe('missingShots', () => {
  it('returns only the shots whose baseline is absent', () => {
    const shots = [
      shot({ baselinePath: 'here.png' }),
      shot({ baselinePath: 'gone.png', storyId: 'components-badge--default' }),
    ];
    const missing = missingShots(shots, (path) => path === 'here.png');
    expect(missing).toHaveLength(1);
    expect(missing[0].storyId).toBe('components-badge--default');
  });

  it('returns an empty array when every baseline exists', () => {
    expect(missingShots([shot({})], () => true)).toEqual([]);
  });
});

describe('grepFor', () => {
  it('is null for an empty list, so a caller cannot build a match-everything pattern', () => {
    expect(grepFor([])).toBeNull();
  });

  it('anchors a story on its trailing double dash', () => {
    expect(grepFor([shot({})])).toBe('components-button--primary · light');
  });

  it('escapes regex metacharacters in a title', () => {
    const pattern = grepFor([shot({ title: 'components-input--a.b · light' })]);
    expect(pattern).toBe('components-input--a\\.b · light');
    expect(new RegExp(pattern).test('components-input--a.b · light')).toBe(true);
    expect(new RegExp(pattern).test('components-input--axb · light')).toBe(false);
  });

  it('never emits a ^ anchor, which playwright matches against the file path', () => {
    expect(
      grepFor([shot({ title: '/components/button · dark', route: '/components/button' })]),
    ).not.toMatch(/\^/);
  });

  it('joins many shots with alternation and de-duplicates', () => {
    const pattern = grepFor([shot({}), shot({}), shot({ title: '/ · dark' })]);
    expect(pattern).toBe('components-button--primary · light|/ · dark');
  });
});
