import { describe, expect, it } from 'vitest';
import { describeNpmFailure, normalizeVersionsPayload, RegistryError } from './registry.mjs';

describe('describeNpmFailure', () => {
  it('turns an auth failure into the fix', () => {
    const hint = describeNpmFailure('npm error code E401\nnpm error 401 Unauthorized');
    expect(hint).toContain('pnpm config set');
    expect(hint).toContain('npm.pkg.github.com');
  });

  it('recognises a 404 as an unpublished or unreachable package', () => {
    expect(describeNpmFailure('npm error code E404')).toMatch(/not found/i);
  });

  it('recognises a network failure', () => {
    expect(describeNpmFailure('npm error code ENOTFOUND')).toMatch(/network/i);
  });

  it('falls back to a generic hint', () => {
    expect(describeNpmFailure('something else entirely')).toMatch(/npm/i);
  });
});

describe('RegistryError', () => {
  it('carries the hint alongside the message', () => {
    const error = new RegistryError('npm view failed', 'set your token');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RegistryError');
    expect(error.hint).toBe('set your token');
  });
});

describe('normalizeVersionsPayload', () => {
  it('passes an array through', () => {
    expect(normalizeVersionsPayload(['1.0.0', '1.1.0'])).toEqual(['1.0.0', '1.1.0']);
  });

  it('wraps the bare string npm returns for a single-version package', () => {
    expect(normalizeVersionsPayload('1.0.0')).toEqual(['1.0.0']);
  });

  it('returns an empty list for null', () => {
    expect(normalizeVersionsPayload(null)).toEqual([]);
  });
});
