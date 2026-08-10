import { describe, expect, it } from 'vitest';
import { compareVersions, jumpClass, parseVersion, selectTarget } from './semver.mjs';

describe('parseVersion', () => {
  it('parses a plain release', () => {
    expect(parseVersion('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: [],
    });
  });

  it('parses numeric prerelease identifiers as numbers', () => {
    expect(parseVersion('1.0.0-beta.2')).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ['beta', 2],
    });
  });

  it('returns null for unparseable input', () => {
    expect(parseVersion('not-a-version')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('compareVersions', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('1.0.2', '1.0.10')).toBe(-1);
  });

  it('treats equal versions as equal', () => {
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
  });

  it('sorts a prerelease below its release', () => {
    expect(compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
  });

  it('orders prerelease identifiers, numeric below alphanumeric', () => {
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
  });

  it('throws on unparseable input', () => {
    expect(() => compareVersions('1.0.0', 'garbage')).toThrow(TypeError);
  });
});

describe('jumpClass', () => {
  it('names the largest changed component', () => {
    expect(jumpClass('1.1.0', '2.0.0')).toBe('major');
    expect(jumpClass('1.1.0', '1.4.0')).toBe('minor');
    expect(jumpClass('1.1.0', '1.1.3')).toBe('patch');
    expect(jumpClass('1.1.0', '1.1.0')).toBe('none');
  });

  it('names a prerelease-only difference', () => {
    expect(jumpClass('1.0.0-beta.1', '1.0.0-beta.2')).toBe('prerelease');
  });

  it('treats 0.x minor bumps as major, matching semver convention', () => {
    expect(jumpClass('0.2.0', '0.3.0')).toBe('major');
    expect(jumpClass('0.2.0', '0.2.1')).toBe('patch');
  });
});

describe('selectTarget', () => {
  const VERSIONS = ['1.0.0', '1.0.2', '1.2.0', '1.2.3', '1.4.0', '2.0.0', '2.1.0'];

  it('takes the newest published version for latest', () => {
    expect(selectTarget('1.0.2', VERSIONS, 'latest')).toBe('2.1.0');
  });

  it('stays inside the current major for minor', () => {
    expect(selectTarget('1.0.2', VERSIONS, 'minor')).toBe('1.4.0');
  });

  it('stays inside the current major.minor for patch', () => {
    expect(selectTarget('1.2.0', VERSIONS, 'patch')).toBe('1.2.3');
  });

  it('returns the current version when it is already the ceiling', () => {
    expect(selectTarget('2.1.0', VERSIONS, 'latest')).toBe('2.1.0');
    expect(selectTarget('1.4.0', VERSIONS, 'minor')).toBe('1.4.0');
  });

  it('never selects a prerelease', () => {
    expect(selectTarget('1.0.0', ['1.0.0', '1.1.0', '2.0.0-beta.1'], 'latest')).toBe('1.1.0');
  });

  it('accepts a prerelease as the current version', () => {
    expect(selectTarget('1.0.0-beta.1', ['1.0.0-beta.1', '1.0.0'], 'latest')).toBe('1.0.0');
  });

  it('returns null when nothing qualifies', () => {
    expect(selectTarget('1.0.0', [], 'latest')).toBeNull();
    expect(selectTarget('3.0.0', VERSIONS, 'latest')).toBeNull();
    expect(selectTarget('1.0.0', ['0.9.0'], 'latest')).toBeNull();
  });

  it('ignores unparseable entries in the version list', () => {
    expect(selectTarget('1.0.0', ['1.0.0', 'garbage', '1.1.0'], 'latest')).toBe('1.1.0');
  });

  it('rejects an unknown target', () => {
    expect(() => selectTarget('1.0.0', VERSIONS, 'sideways')).toThrow(/Unknown target/);
  });
});
