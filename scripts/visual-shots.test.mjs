import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('scripts project wiring', () => {
  it('is a private, ESM-only workspace package', () => {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe('module');
  });
});
