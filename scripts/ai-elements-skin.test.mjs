/* The token skin's destructive-fill entries, run against the real upstream strings.
 *
 * `no-hardcoded-design-values` does not flag `bg-destructive/90` (it is a token
 * with an alpha), so nothing but this file notices if the entries are deleted.
 */

import { describe, expect, it } from 'vitest';

import { apply } from './ai-elements-patches/skin.mjs';

const run = (classes) => apply(`const c = "${classes}";`).source;

describe('token-skin: destructive fill', () => {
  it('maps the Button hover and drops the dark dim', () => {
    const out = run(
      'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60',
    );
    expect(out).toContain('hover:bg-destructive-hover');
    expect(out).not.toContain('dark:bg-destructive/60');
    expect(out).not.toContain('/90');
  });

  it('keeps the variant prefix on the Badge anchor hover', () => {
    const out = run('bg-destructive [a&]:hover:bg-destructive/90 dark:bg-destructive/60');
    expect(out).toBe('const c = "bg-destructive [a&]:hover:bg-destructive-hover";');
  });

  it('maps the SpeechInput /80 hover', () => {
    expect(run('bg-destructive hover:bg-destructive/80')).toContain('hover:bg-destructive-hover');
  });

  it('keeps a dark dim that has no solid base fill beside it', () => {
    expect(run('bg-destructive/10 text-destructive dark:bg-destructive/60')).toContain(
      'dark:bg-destructive/60',
    );
    expect(run('hover:bg-destructive/90 dark:bg-destructive/60')).toContain(
      'dark:bg-destructive/60',
    );
  });

  it('leaves a resting alpha fill alone', () => {
    expect(run('bg-destructive/80')).toBe('const c = "bg-destructive/80";');
  });
});
