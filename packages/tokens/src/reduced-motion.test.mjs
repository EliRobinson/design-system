/* The reduced-motion clamp settles loops (#336).
 *
 * tokens.css clamps `animation-duration` to 0.01ms under
 * `prefers-reduced-motion: reduce`. A finite animation then lands on its final
 * frame. An `infinite` one keeps looping at 0.01ms a cycle, so each paint shows
 * a random frame: frozen with jumps. The clamp also sets the iteration count to
 * 1, so a loop plays once and then rests on the element's own style.
 *
 * Measured in a real engine with the preference emulated, because jsdom has no
 * animation timeline.
 */

import { beforeAll, expect, it } from 'vitest';

import { BROWSER_BUDGET, bootBrowser, openTokensPage } from './browser.test-helper.mjs';

const { browser, describeBrowser } = await bootBrowser('reduced motion');

/* The probe fades from 1 to 0.5. A loop that plays once rests on the element's
   own style, so it reads 1 every time. A strobing loop reads a mix. */
const HTML = `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="/tokens.css">
  <style>
    @keyframes probe { from { opacity: 1; } to { opacity: 0.5; } }
    #loop { animation: probe 1s linear infinite; }
  </style></head><body>
  <div id="loop">loop</div>
  </body></html>`;

async function read(reducedMotion) {
  const context = await browser.newContext({ reducedMotion });
  const page = await context.newPage();
  await openTokensPage(page, HTML);
  const result = await page.evaluate(async () => {
    const loop = document.getElementById('loop');
    const opacities = [];
    for (let i = 0; i < 20; i += 1) {
      opacities.push(Number(getComputedStyle(loop).opacity).toFixed(2));
      await new Promise((resolve) => setTimeout(resolve, 37));
    }
    return {
      iterations: getComputedStyle(loop).animationIterationCount,
      opacities,
    };
  });
  await context.close();
  return result;
}

describeBrowser('the reduced-motion clamp', () => {
  let reduced;
  let normal;
  beforeAll(async () => {
    reduced = await read('reduce');
    normal = await read('no-preference');
  }, BROWSER_BUDGET);

  it('plays an infinite animation once', () => {
    expect(reduced.iterations).toBe('1');
  });

  it('rests on one frame instead of strobing', () => {
    expect([...new Set(reduced.opacities)]).toEqual(['1.00']);
  });

  it('leaves loops alone when there is no preference', () => {
    expect(normal.iterations).toBe('infinite');
    expect(new Set(normal.opacities).size).toBeGreaterThan(5);
  });
});
