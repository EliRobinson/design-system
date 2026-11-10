/* The Spinner under `prefers-reduced-motion: reduce`, measured in a browser.
 *
 * #332: tokens.css clamps every animation to 0.01ms under reduced motion. That
 * settles a finite animation, but an `infinite` one keeps looping — 0.7s of spin
 * squeezed into 0.01ms. Sampled every 37ms, the ring sat at one angle and then
 * jumped. A user who asked for less motion saw a loader that looked stuck.
 *
 * jsdom has no animation timeline, so the only honest check is the one the
 * audit made: emulate the preference in a real engine and sample the computed
 * style over time.
 *
 * #336 added the clamp's `animation-iteration-count: 1`; the Skeleton and
 * StreamingCaret cases below check that loops settle and the caret stays solid.
 *
 * Skipped, loudly, when no browser is available — the same contract as
 * anchored-panel-width and select-intrinsic-width.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/* Reached through the exports map, for the reason component-css.test.mjs gives. */
import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';

const ATOMS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 'atoms');
const STYLESHEETS = {
  'Spinner.css': join(ATOMS, 'Spinner.css'),
  'Skeleton.css': join(ATOMS, 'Skeleton.css'),
  'StreamingCaret.css': join(ATOMS, '..', 'ai', 'StreamingCaret.css'),
};

/* Same budget, and the same reason, as packages/tokens' browser tests. */
const BROWSER_BUDGET = 60_000;

/* tokens.css @imports its siblings relatively, so it has to be served from a
   URL with a directory. Same arrangement as anchored-panel-width. */
const ORIGIN = 'https://spinner.test';

/* 40 samples 50ms apart is two seconds: more than one full cycle of any calm
   pulse, and long enough that a loop clamped to 0.01ms shows its jumps. */
const SAMPLES = 40;
const INTERVAL_MS = 50;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}

let browser;
let launchError;
if (chromium) {
  try {
    browser = await chromium.launch();
  } catch (error) {
    launchError = error;
  }
}

afterAll(async () => {
  await browser?.close();
}, BROWSER_BUDGET);

const describeBrowser = browser ? describe : describe.skip;
if (!browser) {
  console.warn(
    `Skipping spinner reduced-motion tests: ${
      chromium ? launchError?.message : 'playwright is not installed'
    }`,
  );
}

/**
 * Open the Spinner (and two controls) under the given motion preference, and
 * read each subject's computed animation, plus SAMPLES readings of the
 * Spinner's transform and opacity taken INTERVAL_MS apart.
 *
 * @param {'reduce' | 'no-preference'} reducedMotion
 */
async function sample(reducedMotion) {
  const context = await browser.newContext({ reducedMotion });
  const page = await context.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <link rel="stylesheet" href="/tokens.css">
          <link rel="stylesheet" href="/Spinner.css">
          <link rel="stylesheet" href="/Skeleton.css">
          <link rel="stylesheet" href="/StreamingCaret.css">
          <style>
            @keyframes probe { to { opacity: 0.5; } }
            #probe { animation: probe 1s linear infinite; transition: opacity 1s; }
          </style>
          </head><body>
          <span id="spinner" class="ds-spinner ds-spinner--lg" role="status" aria-label="Loading"></span>
          <div id="skeleton" class="ds-skeleton"></div>
          <span id="caret" class="ds-streaming-caret"></span>
          <div id="probe">probe</div>
          </body></html>`,
      });
    }

    const local = STYLESHEETS[name] ?? join(TOKENS_SRC_DIR, name);
    if (!existsSync(local)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(local),
    });
  });

  await page.goto(`${ORIGIN}/index.html`);

  const result = await page.evaluate(
    async ({ samples, interval }) => {
      const animation = (id) => {
        const style = getComputedStyle(document.getElementById(id));
        return {
          name: style.animationName,
          duration: style.animationDuration,
          iterations: style.animationIterationCount,
          transition: style.transitionDuration,
        };
      };

      const spinner = document.getElementById('spinner');
      const readings = [];
      for (let i = 0; i < samples; i += 1) {
        const style = getComputedStyle(spinner);
        readings.push({ transform: style.transform, opacity: Number(style.opacity) });
        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      return {
        spinner: animation('spinner'),
        skeleton: animation('skeleton'),
        probe: animation('probe'),
        caret: {
          ...animation('caret'),
          opacity: getComputedStyle(document.getElementById('caret')).opacity,
        },
        readings,
      };
    },
    { samples: SAMPLES, interval: INTERVAL_MS },
  );

  await context.close();
  return result;
}

/** Seconds, from a computed `animation-duration` like `1.68s` or `1e-05s`. */
const seconds = (duration) => Number.parseFloat(duration);

/* One sample per preference, shared by the cases below. Each sample loads a
   page and reads for two seconds, which does not fit Vitest's 5s per-test
   default on a loaded runner, so it runs in a hook with the browser budget. */
describeBrowser('the Spinner under prefers-reduced-motion: reduce', () => {
  let reduced;
  beforeAll(async () => {
    reduced = await sample('reduce');
  }, BROWSER_BUDGET);

  it('does not rotate', () => {
    // Every sample, not most of them. The bug was 1 jump in 8 frozen frames.
    expect(reduced.readings.map((reading) => reading.transform)).toEqual(
      reduced.readings.map(() => 'none'),
    );
  });

  it('is not frozen: it pulses slowly enough to read as "still working"', () => {
    const { spinner, readings } = reduced;

    // The pulse runs at a calm pace, not at the global 0.01ms clamp.
    expect(spinner.iterations).toBe('infinite');
    expect(seconds(spinner.duration)).toBeGreaterThanOrEqual(1);

    // Frozen-with-jumps shows at most two values. A pulse sampled across two
    // seconds shows many, and never fades the ring away entirely.
    const opacities = readings.map((reading) => reading.opacity);
    expect(new Set(opacities.map((value) => value.toFixed(2))).size).toBeGreaterThanOrEqual(10);
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.4);
    expect(Math.max(...opacities)).toBeGreaterThan(0.9);
  });

  it('leaves the global clamp in force for everything else', () => {
    const { skeleton, probe } = reduced;

    expect(seconds(probe.duration)).toBeLessThan(0.001);
    expect(seconds(probe.transition)).toBeLessThan(0.001);
    // Skeleton stays under the clamp; #332 accepts that for a placeholder.
    expect(seconds(skeleton.duration)).toBeLessThan(0.001);
    // The clamp plays loops once (#336), so the placeholder settles, not strobes.
    expect(skeleton.iterations).toBe('1');
  });
});

describeBrowser('the StreamingCaret under reduced motion', () => {
  let reduced;
  beforeAll(async () => {
    reduced = await sample('reduce');
  }, BROWSER_BUDGET);

  it('stays a solid caret: no animation, fully opaque', () => {
    expect(reduced.caret.name).toBe('none');
    expect(reduced.caret.opacity).toBe('1');
  });
});

describeBrowser('the Spinner with no motion preference', () => {
  let normal;
  beforeAll(async () => {
    normal = await sample('no-preference');
  }, BROWSER_BUDGET);

  it('still spins, so the reduced-motion block has not leaked out', () => {
    expect(normal.spinner.name).toBe('ds-spin');
    expect(new Set(normal.readings.map((reading) => reading.transform)).size).toBeGreaterThan(10);
  });
});
