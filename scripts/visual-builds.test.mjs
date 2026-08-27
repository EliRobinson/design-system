/* The behaviour worth pinning here is the asymmetry: absent builds are a skip
   for a person and a hard failure for Nx. Get that backwards in either
   direction and the cost is silent — a bare checkout that cannot run the suite
   at all, or a CI run that goes green having enumerated nothing. */

import { describe, expect, it } from 'vitest';

import { REQUIRED_BUILDS, buildsPresent } from './visual-builds.mjs';

const present = () => true;
const absent = () => false;
/* Only the Storybook build missing, so a partial state is covered too: the
   suites need both, and `nx affected` can rebuild one without the other. */
const storybookMissing = (path) => path !== REQUIRED_BUILDS[0];

describe('buildsPresent', () => {
  it('names both build outputs the Playwright suites read', () => {
    expect([...REQUIRED_BUILDS]).toEqual([
      '../apps/storybook/storybook-static/index.json',
      '../apps/docs/.next/prerender-manifest.json',
    ]);
  });

  it('is true when both builds are there, whoever is running', () => {
    expect(buildsPresent({ exists: present, env: {} })).toBe(true);
    expect(buildsPresent({ exists: present, env: { NX_TASK_TARGET_PROJECT: 'scripts' } })).toBe(
      true,
    );
  });

  it('is false on a bare checkout, so `vitest run` still works there', () => {
    expect(buildsPresent({ exists: absent, env: {} })).toBe(false);
  });

  it('throws under an Nx task rather than skipping, because Nx ordered the builds', () => {
    expect(() =>
      buildsPresent({ exists: absent, env: { NX_TASK_TARGET_PROJECT: 'scripts' } }),
    ).toThrow(/implicitDependencies/);
  });

  /* The message has to name the path, not just say "a build is missing":
     which of the two is gone is what says whether the graph edge broke or the
     directory was emptied underneath a running suite. */
  it('names the missing build in the failure, and only that one', () => {
    expect(() =>
      buildsPresent({ exists: storybookMissing, env: { NX_TASK_TARGET_PROJECT: 'scripts' } }),
    ).toThrow(/storybook-static\/index\.json/);
    expect(() =>
      buildsPresent({ exists: storybookMissing, env: { NX_TASK_TARGET_PROJECT: 'scripts' } }),
    ).not.toThrow(/prerender-manifest/);
  });

  it('treats one missing side as not-built, so a half-built checkout still skips', () => {
    expect(buildsPresent({ exists: storybookMissing, env: {} })).toBe(false);
  });
});
