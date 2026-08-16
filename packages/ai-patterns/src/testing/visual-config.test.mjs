// The preset's whole value is that a consumer does not restate these settings,
// which means nothing in their repo would notice if one of them went missing.
// These are the assertions that would otherwise only exist as a comment.

import { describe, expect, it, vi } from 'vitest';

import {
  FIXED_TIME,
  NARROW_VIEWPORT,
  SNAPSHOT_PATH_TEMPLATE,
  VISUAL_CONTAINER_ENV,
  WIDE_VIEWPORT,
  applyFixedClock,
  assertContainedBaselineUpdate,
  defineVisualConfig,
  inVisualContainer,
} from './visual-config.mjs';

const OUTSIDE = { argv: ['node', 'playwright', 'test'], env: {} };
const INSIDE = { argv: ['node', 'playwright', 'test'], env: { [VISUAL_CONTAINER_ENV]: '1' } };

describe('the baseline-update guard', () => {
  it('refuses a short-flag update outside the container', () => {
    expect(() =>
      assertContainedBaselineUpdate({ ...OUTSIDE, argv: [...OUTSIDE.argv, '-u'] }),
    ).toThrow(/Refusing to update baselines outside the pinned container/);
  });

  it('refuses the long flag, with or without a value', () => {
    for (const flag of [
      '--update-snapshots',
      '--update-snapshots=all',
      '--update-snapshots=changed',
    ]) {
      expect(
        () => assertContainedBaselineUpdate({ ...OUTSIDE, argv: [...OUTSIDE.argv, flag] }),
        `${flag} slipped through`,
      ).toThrow(/Refusing to update baselines/);
    }
  });

  it('allows the update inside the container', () => {
    expect(() =>
      assertContainedBaselineUpdate({ ...INSIDE, argv: [...INSIDE.argv, '-u'] }),
    ).not.toThrow();
  });

  it('allows an ordinary run outside the container', () => {
    expect(() => assertContainedBaselineUpdate(OUTSIDE)).not.toThrow();
  });

  /* An argument that merely contains the flag as a substring is somebody's
     test title or file path, not a request to rewrite 500 baselines. */
  it('does not fire on an argument that only mentions the flag', () => {
    expect(() =>
      assertContainedBaselineUpdate({
        ...OUTSIDE,
        argv: [...OUTSIDE.argv, '--grep=--update-snapshots'],
      }),
    ).not.toThrow();
  });

  it('names the command that does it properly', () => {
    expect(() =>
      assertContainedBaselineUpdate({ ...OUTSIDE, argv: ['-u'], updateCommand: 'make baselines' }),
    ).toThrow(/make baselines/);
  });
});

describe('inVisualContainer', () => {
  it('reads the container flag', () => {
    expect(inVisualContainer({ [VISUAL_CONTAINER_ENV]: '1' })).toBe(true);
    expect(inVisualContainer({})).toBe(false);
  });
});

describe('defineVisualConfig', () => {
  it('compares screenshots exactly, in all three senses Playwright offers', () => {
    const { toHaveScreenshot } = defineVisualConfig({}, OUTSIDE).expect;

    /* threshold is the one that is easy to get wrong: Playwright defaults it to
       0.2, under which a one-step shift inside a colour ramp compares equal. */
    expect(toHaveScreenshot.threshold).toBe(0);
    expect(toHaveScreenshot.maxDiffPixels).toBe(0);
    expect(toHaveScreenshot.maxDiffPixelRatio).toBe(0);
    expect(toHaveScreenshot.animations).toBe('disabled');
  });

  it('pins everything a render can otherwise vary by', () => {
    const { use } = defineVisualConfig({}, OUTSIDE);

    expect(use).toMatchObject({
      locale: 'en-US',
      timezoneId: 'UTC',
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      viewport: WIDE_VIEWPORT,
    });
  });

  it('never retries a comparison', () => {
    /* A retry turns a genuine nondeterminism bug into an intermittent pass,
       which is the failure mode a visual suite exists to prevent. */
    expect(defineVisualConfig({}, OUTSIDE).retries).toBe(0);
  });

  it('refuses to write a missing baseline outside the container', () => {
    expect(defineVisualConfig({}, OUTSIDE).updateSnapshots).toBe('none');
  });

  it('leaves Playwright to decide inside the container', () => {
    /* undefined, not 'all': --update-snapshots still has to be passed. */
    expect(defineVisualConfig({}, INSIDE).updateSnapshots).toBeUndefined();
  });

  it('installs the guard when it builds the config', () => {
    expect(() => defineVisualConfig({}, { ...OUTSIDE, argv: ['-u'] })).toThrow(
      /Refusing to update baselines/,
    );
  });

  it('groups baselines by project', () => {
    expect(defineVisualConfig({}, OUTSIDE).snapshotPathTemplate).toBe(SNAPSHOT_PATH_TEMPLATE);
    expect(SNAPSHOT_PATH_TEMPLATE).toContain('{projectName}');
  });

  it("takes the caller's own config verbatim", () => {
    const config = defineVisualConfig(
      { testDir: './tests/visual', projects: [{ name: 'smoke' }] },
      OUTSIDE,
    );

    expect(config.testDir).toBe('./tests/visual');
    expect(config.projects).toEqual([{ name: 'smoke' }]);
  });

  /* The failure mode a spread-based preset has, and the reason this merges two
     levels down: setting one option under `expect` or `use` would otherwise
     silently discard the exact-comparison settings beneath it. */
  it('keeps the contract when the caller overrides a neighbouring option', () => {
    const config = defineVisualConfig(
      { expect: { timeout: 1_000 }, use: { viewport: NARROW_VIEWPORT } },
      OUTSIDE,
    );

    expect(config.expect.timeout).toBe(1_000);
    expect(config.expect.toHaveScreenshot.threshold).toBe(0);
    expect(config.use.viewport).toBe(NARROW_VIEWPORT);
    expect(config.use.timezoneId).toBe('UTC');
  });

  it('still lets a caller who means it override the contract', () => {
    const config = defineVisualConfig(
      { expect: { toHaveScreenshot: { threshold: 0.2 } } },
      OUTSIDE,
    );

    expect(config.expect.toHaveScreenshot.threshold).toBe(0.2);
    expect(config.expect.toHaveScreenshot.animations).toBe('disabled');
  });

  it('reports the CI reporter pair only under CI', () => {
    expect(defineVisualConfig({}, OUTSIDE).reporter).toEqual([['list']]);
    expect(defineVisualConfig({}, { ...OUTSIDE, env: { CI: '1' } }).reporter).toEqual([
      ['list'],
      ['html', { open: 'never' }],
    ]);
  });
});

describe('the pinned clock', () => {
  it('freezes the page at the fixed instant', async () => {
    const setFixedTime = vi.fn(async () => {});

    await applyFixedClock({ clock: { setFixedTime } });

    expect(setFixedTime).toHaveBeenCalledWith(FIXED_TIME);
  });

  /* Mid-month and mid-day on purpose: a month boundary makes a date grid shift
     under a timezone slip, and a day boundary does the same to any rendered
     date. A change here silently rewrites what every date-bearing baseline
     shows. */
  it('sits well away from a month or day boundary in UTC', () => {
    expect(FIXED_TIME.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });
});

describe('the shared viewports', () => {
  it('cannot be mutated by one suite on behalf of another', () => {
    expect(Object.isFrozen(WIDE_VIEWPORT)).toBe(true);
    expect(Object.isFrozen(NARROW_VIEWPORT)).toBe(true);
  });
});
