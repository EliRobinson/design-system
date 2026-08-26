import {
  FIXED_TIME,
  assertContainedBaselineUpdate,
  defineVisualConfig,
} from '@elirobinson/ai-patterns/testing/visual-config';

import playwrightConfig from '../../playwright.config';
import { expect, test } from './fixtures';

/* Proves the determinism settings actually bite, before any real baseline
   depends on them. Needs no server and commits no screenshots: every assertion
   compares captures taken within the test, or reads the config this repo
   actually ships.

   A silent failure here would be expensive later — animations that are not
   really disabled produce baselines that pass on the machine that generated
   them and flake everywhere else. */

/* An infinite spin, the shape Spinner and Skeleton use. This is the case the
   reduced-motion clamp in tokens.css cannot settle: clamping an infinite
   animation's duration to 0.01ms makes it cycle faster, not stop.

   The two-tone gradient is what makes rotation visible — a solid fill would
   render identically at every angle and the assertions below would hold
   whether or not the animation ran. */
const INFINITE_ANIMATION = `
  <style>
    @keyframes spin { to { transform: rotate(360deg); } }
    #subject {
      width: 64px;
      height: 64px;
      background: linear-gradient(90deg, #000 50%, #fff 50%);
      animation: spin 800ms linear infinite;
    }
  </style>
  <div id="subject"></div>
`;

/* Animates colour rather than transform, so the change is unmissable inside
   the element's own bounding box, and slowly enough that two captures a
   moment apart are guaranteed to land on different frames. */
const SLOW_ANIMATION = `
  <style>
    @keyframes fade { 0% { background: #000; } 100% { background: #fff; } }
    #subject {
      width: 64px;
      height: 64px;
      background: #000;
      animation: fade 8s linear infinite alternate;
    }
  </style>
  <div id="subject"></div>
`;

test('freezes Date.now() at the fixed time', async ({ page }) => {
  await page.setContent('<p>clock</p>');

  expect(await page.evaluate(() => Date.now())).toBe(FIXED_TIME.getTime());
});

test('holds the fixed time steady as the page runs', async ({ page }) => {
  await page.setContent('<p>clock</p>');

  const first = await page.evaluate(() => Date.now());
  /* A real wait, not a virtual one: timers still fire under setFixedTime,
     which is the whole reason for choosing it over clock.install. Only the
     reported time is frozen. */
  await page.waitForTimeout(250);
  const second = await page.evaluate(() => Date.now());

  expect(second).toBe(first);
});

test("animations: 'disabled' makes an infinite animation reproducible", async ({ page }) => {
  await page.setContent(INFINITE_ANIMATION);
  const subject = page.locator('#subject');

  const first = await subject.screenshot({ animations: 'disabled' });
  await page.waitForTimeout(250);
  const second = await subject.screenshot({ animations: 'disabled' });

  expect(first.equals(second)).toBe(true);
});

test('control: the same capture without the option is not reproducible', async ({ page }) => {
  await page.setContent(SLOW_ANIMATION);
  const subject = page.locator('#subject');

  /* Guards the test above from passing vacuously. If the keyframes never
     applied, the disabled-animations test would still go green and tell us
     nothing at all. */
  const first = await subject.screenshot();
  await page.waitForTimeout(500);
  const second = await subject.screenshot();

  expect(first.equals(second)).toBe(false);
});

/* The settings above are only worth proving if the config this repo ships
   still carries them. It gets them from the published preset now, so these read
   the real exported config rather than restating its values — a preset that
   quietly dropped `threshold: 0` would otherwise be invisible until a colour
   regression sailed through. */
test('the shipped config compares every pixel exactly', () => {
  const screenshot = playwrightConfig.expect?.toHaveScreenshot;

  expect(screenshot?.threshold).toBe(0);
  expect(screenshot?.animations).toBe('disabled');
});

/* Zero colour tolerance, a small count budget — two different levers, and the
   split is the whole point of issue #125. Pinned to exact values here because
   the interesting failure is a silent drift upward: a preset that shipped 64
   would still read as "a small budget" in a diff and would hide most of what
   this suite exists to catch. `maxDiffPixelRatio` must stay unset, since
   Playwright resolves the pair with Math.min and a ratio of 0 would cancel the
   budget back to 0 without changing a line anyone would look at. */
test('the shipped config budgets a handful of pixels for rasteriser noise', () => {
  const screenshot = playwrightConfig.expect?.toHaveScreenshot;

  expect(screenshot?.maxDiffPixels).toBe(8);
  expect(screenshot?.maxDiffPixelRatio).toBeUndefined();
});

test('the shipped config pins everything a render can vary by', () => {
  expect(playwrightConfig.use?.locale).toBe('en-US');
  expect(playwrightConfig.use?.timezoneId).toBe('UTC');
  expect(playwrightConfig.use?.deviceScaleFactor).toBe(1);
  expect(playwrightConfig.use?.serviceWorkers).toBe('block');

  /* Retrying a screenshot comparison turns a nondeterminism bug into an
     intermittent pass, which is the one failure mode this suite exists to
     prevent. */
  expect(playwrightConfig.retries).toBe(0);
});

test('the shipped config never writes a missing baseline by itself', () => {
  /* Playwright's default is 'missing', which silently writes any baseline that
     does not exist yet. Outside the container that bakes this machine's font
     rendering in without anyone passing a flag. */
  expect(playwrightConfig.updateSnapshots).toBe(
    process.env.DS_VISUAL_CONTAINER ? undefined : 'none',
  );
});

test('the preset refuses to update baselines outside the container', () => {
  const outsideContainer = { argv: ['node', 'playwright', 'test', '-u'], env: {} };

  expect(() => assertContainedBaselineUpdate(outsideContainer)).toThrow(
    /Refusing to update baselines/,
  );
  expect(() =>
    assertContainedBaselineUpdate({ ...outsideContainer, argv: ['node', 'playwright', 'test'] }),
  ).not.toThrow();
  expect(() =>
    assertContainedBaselineUpdate({ ...outsideContainer, env: { DS_VISUAL_CONTAINER: '1' } }),
  ).not.toThrow();

  /* The long form has to be caught too — `--update-snapshots=all` is the one a
     CI script is most likely to write. */
  expect(() =>
    assertContainedBaselineUpdate({
      ...outsideContainer,
      argv: ['node', 'playwright', 'test', '--update-snapshots=all'],
    }),
  ).toThrow(/Refusing to update baselines/);
});

test('the preset merges overrides without dropping the contract', () => {
  const merged = defineVisualConfig(
    { testDir: './elsewhere', expect: { timeout: 1_000 } },
    { argv: [], env: {} },
  );

  expect(merged.testDir).toBe('./elsewhere');
  expect(merged.expect.timeout).toBe(1_000);

  /* The failure mode a spread-based preset has: adding one option under
     `expect` silently discards the exact-comparison settings under it. */
  expect(merged.expect.toHaveScreenshot.threshold).toBe(0);
  expect(merged.expect.toHaveScreenshot.animations).toBe('disabled');
});
