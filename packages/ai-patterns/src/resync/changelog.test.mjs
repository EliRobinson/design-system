import { describe, expect, it } from 'vitest';
import { isBreaking, parseChangelog, sliceChangelog } from './changelog.mjs';

const CHANGELOG = `# @elirobinson/react

## 2.0.0

### Major Changes

- abc1234: Removed the deprecated \`variant="ghost"\` value.

## 1.1.0

### Minor Changes

- 1f88949: \`NavigationMenu\`: make \`href\` optional on \`NavigationMenuItem\`.

## 1.0.2

### Patch Changes

- 0dbb837: Fix \`defaultOpen\` being silently ignored.
`;

describe('parseChangelog', () => {
  it('returns one entry per version heading, newest first', () => {
    expect(parseChangelog(CHANGELOG).map((entry) => entry.version)).toEqual([
      '2.0.0',
      '1.1.0',
      '1.0.2',
    ]);
  });

  it('captures the body under each heading without the heading itself', () => {
    const [latest] = parseChangelog(CHANGELOG);
    expect(latest.body).toContain('### Major Changes');
    expect(latest.body).toContain('Removed the deprecated');
    expect(latest.body).not.toContain('## 2.0.0');
    expect(latest.body).not.toContain('NavigationMenu');
  });

  it('ignores the package-name H1 and returns nothing for an empty changelog', () => {
    expect(parseChangelog('# @elirobinson/react\n')).toEqual([]);
    expect(parseChangelog('')).toEqual([]);
  });

  it('skips headings that are not versions', () => {
    expect(parseChangelog('## Unreleased\n\ntext\n')).toEqual([]);
  });
});

describe('sliceChangelog', () => {
  it('excludes the version you are on and includes the one you move to', () => {
    expect(sliceChangelog(CHANGELOG, '1.0.2', '2.0.0').map((e) => e.version)).toEqual([
      '2.0.0',
      '1.1.0',
    ]);
  });

  it('excludes versions published after the target', () => {
    expect(sliceChangelog(CHANGELOG, '1.0.2', '1.1.0').map((e) => e.version)).toEqual(['1.1.0']);
  });

  it('returns nothing when already current', () => {
    expect(sliceChangelog(CHANGELOG, '2.0.0', '2.0.0')).toEqual([]);
  });

  it('returns nothing when the changelog has no matching entries', () => {
    expect(sliceChangelog('# @elirobinson/react\n', '1.0.0', '2.0.0')).toEqual([]);
  });

  it('tolerates an installed version older than every entry', () => {
    expect(sliceChangelog(CHANGELOG, '0.1.0', '2.0.0').map((e) => e.version)).toEqual([
      '2.0.0',
      '1.1.0',
      '1.0.2',
    ]);
  });
});

describe('isBreaking', () => {
  it('is true for an entry with major changes', () => {
    expect(isBreaking({ body: '### Major Changes\n\n- abc: gone\n' })).toBe(true);
  });

  it('is false for minor and patch entries', () => {
    expect(isBreaking({ body: '### Minor Changes\n\n- abc: added\n' })).toBe(false);
    expect(isBreaking({ body: '### Patch Changes\n\n- abc: fixed\n' })).toBe(false);
  });
});
