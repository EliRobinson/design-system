import { describe, expect, it } from 'vitest';
import { checkSelfDrift, formatSelfStaleWarning, readOwnVersion } from './selfcheck.mjs';

describe('readOwnVersion', () => {
  it("reads this package's own name and version from its package.json", () => {
    const own = readOwnVersion();
    expect(own.name).toBe('@elirobinson/ai-patterns');
    expect(own.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('checkSelfDrift', () => {
  it('reports a running copy the registry no longer considers current', () => {
    expect(checkSelfDrift({ running: '0.10.0', latest: '0.27.3' })).toEqual({
      running: '0.10.0',
      latest: '0.27.3',
    });
  });

  it('is quiet when the running copy is the latest', () => {
    expect(checkSelfDrift({ running: '0.27.3', latest: '0.27.3' })).toBeNull();
  });

  it('is quiet when there is no latest to compare against', () => {
    expect(checkSelfDrift({ running: '0.27.3', latest: null })).toBeNull();
  });
});

describe('formatSelfStaleWarning', () => {
  const text = formatSelfStaleWarning(
    { running: '0.10.0', latest: '0.27.3' },
    '@elirobinson/ai-patterns',
  );

  it('names both versions and the package', () => {
    expect(text).toContain('STALE BINARY');
    expect(text).toContain('@elirobinson/ai-patterns@0.10.0');
    expect(text).toContain('0.27.3');
  });

  it('points at dlx as the likely cause and installing as the fix', () => {
    expect(text).toContain('pnpm dlx');
    expect(text).toContain('pnpm add -D @elirobinson/ai-patterns');
    expect(text).toContain('./node_modules/.bin/ds-resync');
  });
});
