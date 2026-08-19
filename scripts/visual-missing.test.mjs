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

  /* Playwright's --grep matches title text only, and every Storybook story
     title is identical between the `storybook-wide` and `storybook-narrow`
     projects (same for @responsive docs routes across `docs-wide` /
     `docs-narrow`). So a pattern built from one project's shot also matches
     its sibling project's shot of the same title — this is not a bug to fix
     here, it is why callers regenerating baselines with this pattern MUST
     pass `--update-snapshots=missing` explicitly: a bare `--update-snapshots`
     defaults to `changed` mode and would overwrite the sibling's existing,
     correct baseline the moment it differs. */
  it('selects by title, so a pattern also matches the same title in a sibling project', () => {
    const wide = shot({ project: 'storybook-wide' });
    const narrow = shot({ project: 'storybook-narrow' });

    const pattern = grepFor([wide]);

    expect(new RegExp(pattern).test(narrow.title)).toBe(true);
  });
});
