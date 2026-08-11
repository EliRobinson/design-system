import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TARGET_SPEC,
  normalizePackageName,
  parseOnly,
  parseTargetSpec,
  resolveTarget,
  TARGETS,
} from './targets.mjs';

describe('normalizePackageName', () => {
  it('prepends the scope to a short name', () => {
    expect(normalizePackageName('react')).toBe('@elirobinson/react');
  });

  it('leaves an already-qualified name alone', () => {
    expect(normalizePackageName('@elirobinson/react')).toBe('@elirobinson/react');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePackageName('  tokens ')).toBe('@elirobinson/tokens');
  });
});

describe('parseOnly', () => {
  it('splits and normalises a comma-separated list', () => {
    expect(parseOnly('react, tokens')).toEqual(['@elirobinson/react', '@elirobinson/tokens']);
  });

  it('accepts qualified names', () => {
    expect(parseOnly('@elirobinson/react')).toEqual(['@elirobinson/react']);
  });

  it('drops empty segments from a trailing comma', () => {
    expect(parseOnly('react,')).toEqual(['@elirobinson/react']);
  });
});

describe('parseTargetSpec', () => {
  it('reads a bare target as the fallback for every package', () => {
    expect(parseTargetSpec('minor')).toEqual({ fallback: 'minor', byName: {} });
  });

  it('reads per-package assignments', () => {
    expect(parseTargetSpec('react=minor,tokens=patch')).toEqual({
      fallback: 'latest',
      byName: { '@elirobinson/react': 'minor', '@elirobinson/tokens': 'patch' },
    });
  });

  it('reads a bare target mixed with assignments', () => {
    expect(parseTargetSpec('minor,react=latest')).toEqual({
      fallback: 'minor',
      byName: { '@elirobinson/react': 'latest' },
    });
  });

  it('rejects an unknown target value', () => {
    expect(() => parseTargetSpec('sideways')).toThrow(/Unknown target/);
    expect(() => parseTargetSpec('react=sideways')).toThrow(/Unknown target/);
  });

  it('names the valid targets in the error', () => {
    expect(() => parseTargetSpec('sideways')).toThrow(/latest/);
  });
});

describe('resolveTarget', () => {
  it('prefers a per-package target over the fallback', () => {
    const spec = parseTargetSpec('minor,react=patch');
    expect(resolveTarget(spec, '@elirobinson/react')).toBe('patch');
    expect(resolveTarget(spec, '@elirobinson/tokens')).toBe('minor');
  });

  it('defaults to latest', () => {
    expect(resolveTarget(DEFAULT_TARGET_SPEC, '@elirobinson/react')).toBe('latest');
  });
});

describe('TARGETS', () => {
  it('is exactly the three supported distances', () => {
    expect(TARGETS).toEqual(['latest', 'minor', 'patch']);
  });
});
