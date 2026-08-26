// Playwright's own collection is the enumerator here, so these tests feed it a
// recorded `--list --reporter=json` payload rather than re-describing the
// suite. What is actually under test is the title-to-baseline mapping, which
// mirrors the `name` callbacks in visual-sweep.mjs and is the one thing that
// could drift without anything reporting it.

import { describe, expect, it } from 'vitest';

import { SPEC_FILE_BY_PROJECT, parseShots } from './visual-shots.mjs';

/* The shape Playwright emits: top-level suites carry `specs`, each spec has
   `tests` carrying `projectName`. Nested suites are possible, so parseShots
   must recurse. */
const listJson = {
  suites: [
    {
      title: 'config.smoke.spec.ts',
      file: 'config.smoke.spec.ts',
      specs: [
        { title: 'refuses to update outside the container', tests: [{ projectName: 'smoke' }] },
      ],
    },
    {
      title: 'storybook/storybook.spec.ts',
      file: '../../packages/ai-patterns/src/testing/visual-sweep.mjs',
      specs: [
        {
          title: 'components-button--primary · light',
          tests: [{ projectName: 'storybook-wide' }, { projectName: 'storybook-narrow' }],
        },
        { title: '/ · dark', tests: [{ projectName: 'docs-wide' }] },
        { title: '/patterns/forms · light @responsive', tests: [{ projectName: 'docs-narrow' }] },
        { title: '/components/date-picker · dark', tests: [{ projectName: 'docs-wide' }] },
      ],
    },
  ],
};

describe('parseShots', () => {
  const shots = parseShots(listJson);

  it('drops the smoke project, which takes no baselines', () => {
    expect(shots.some((shot) => shot.project === 'smoke')).toBe(false);
  });

  it('emits one shot per project per spec', () => {
    expect(shots).toHaveLength(5);
  });

  it('maps a story title to its baseline path', () => {
    const shot = shots.find((s) => s.project === 'storybook-wide');
    expect(shot.storyId).toBe('components-button--primary');
    expect(shot.route).toBeNull();
    expect(shot.theme).toBe('light');
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/storybook-wide/storybook/storybook.spec.ts/components-button--primary-light.png',
    );
  });

  it('maps the root route to the index slug', () => {
    const shot = shots.find((s) => s.title === '/ · dark');
    expect(shot.route).toBe('/');
    expect(shot.storyId).toBeNull();
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/docs-wide/docs/docs.spec.ts/index-dark.png',
    );
  });

  it('strips the @responsive tag before reading the theme', () => {
    const shot = shots.find((s) => s.project === 'docs-narrow');
    expect(shot.route).toBe('/patterns/forms');
    expect(shot.theme).toBe('light');
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/docs-narrow/docs/docs.spec.ts/patterns-forms-light.png',
    );
  });

  it('flattens nested route segments into the slug with dashes', () => {
    const shot = shots.find((s) => s.title === '/components/date-picker · dark');
    expect(shot.baselinePath).toBe(
      'tests/visual/__screenshots__/docs-wide/docs/docs.spec.ts/components-date-picker-dark.png',
    );
  });

  it('refuses a project it has no spec file for, rather than guessing', () => {
    const rogue = {
      suites: [{ specs: [{ title: 'x · light', tests: [{ projectName: 'tablet' }] }] }],
    };
    expect(() => parseShots(rogue)).toThrow(/tablet/);
  });

  it('knows the four baseline-taking projects', () => {
    expect(Object.keys(SPEC_FILE_BY_PROJECT).sort()).toEqual([
      'docs-narrow',
      'docs-wide',
      'storybook-narrow',
      'storybook-wide',
    ]);
  });
});

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { listShots } from './visual-shots.mjs';

/* The mapping above is asserted against fixtures, which proves it is
   self-consistent and not that it matches Playwright. This does: every baseline
   on disk must be a path this module computes, and vice versa. If Playwright
   changes how it resolves {testFilePath}, or a viewport project is added to the
   config and not to SPEC_FILE_BY_PROJECT, this is what reports it. */
const BUILDS_PRESENT =
  existsSync('../apps/storybook/storybook-static/index.json') &&
  existsSync('../apps/docs/.next/prerender-manifest.json');

describe.skipIf(!BUILDS_PRESENT)('computed baseline paths vs the ones on disk', () => {
  it('agree exactly, in both directions', () => {
    const computed = new Set(listShots({ cwd: '..' }).map((shot) => shot.baselinePath));

    const root = '../tests/visual/__screenshots__';
    const onDisk = new Set();
    for (const project of readdirSync(root)) {
      for (const specDir of readdirSync(join(root, project))) {
        for (const specFile of readdirSync(join(root, project, specDir))) {
          for (const png of readdirSync(join(root, project, specDir, specFile))) {
            onDisk.add(`tests/visual/__screenshots__/${project}/${specDir}/${specFile}/${png}`);
          }
        }
      }
    }

    /* Sorted arrays rather than set equality: on a failure the diff names the
       paths, which is the whole value of running this. */
    expect([...computed].sort()).toEqual([...onDisk].sort());
    /* `listShots` spawns `playwright test --list`, so vitest's 5s default was
       never this test's budget — it was the budget for a process start, a
       config load and an enumeration of every route in the docs build. It runs
       in well under a second locally and between 3.5s and 4.6s on a GitHub
       runner, which is 70-91% of the default: passing, until the runner has a
       slow minute. Three branches tipped over it within one hour on 2026-08-26
       (runs 32953635367, 32952490856, 32951324375), every one of them on a
       change that touches nothing this test reads. Timing out is also the
       least useful way for this to fail, because it reports a clock rather
       than the paths that disagree. 30s is picked to be far outside the
       spread, not to be a near miss in the other direction. */
  }, 30_000);
});
