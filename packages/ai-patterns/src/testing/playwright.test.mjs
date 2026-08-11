// These helpers make claims about rendered geometry and computed colour, so
// they are tested in a real browser against fixtures that deliberately violate
// each contract — and against neighbours that satisfy it, since a check that
// fires on everything is worse than no check.
//
// Skipped, loudly, when no browser is available (a bare CI image). The suite is
// the verification; it should not be the thing that blocks an unrelated change.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  checkContrast,
  checkFocusVisible,
  checkHitAreaOverlap,
  checkTouchTargets,
  expectDesignSystemContracts,
  MINIMUM_TOUCH_TARGET,
  PRIMARY_CONTROL_SELECTOR,
} from './playwright.mjs';

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
});

const describeBrowser = browser ? describe : describe.skip;

if (!browser) {
  console.warn(
    `Skipping browser contract tests: ${chromium ? launchError?.message : 'playwright is not installed'}`,
  );
}

describe('argument handling', () => {
  it('rejects anything that is not a Playwright page', async () => {
    await expect(checkTouchTargets({})).rejects.toThrow(/Playwright Page/);
    await expect(checkFocusVisible(null)).rejects.toThrow(/Playwright Page/);
  });

  it('exports the contract values it enforces', () => {
    expect(MINIMUM_TOUCH_TARGET).toBe(44);
    expect(PRIMARY_CONTROL_SELECTOR).toContain('button');
  });
});

describeBrowser('browser contract checks', () => {
  let page;

  beforeAll(async () => {
    page = await browser.newPage();
  });

  async function render(body) {
    await page.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; margin: 0; }
      body { background: #ffffff; color: #000000; font: 16px system-ui; padding: 40px; }
    </style></head><body>${body}</body></html>`);
  }

  describe('checkTouchTargets', () => {
    it('flags a control smaller than 44x44', async () => {
      await render('<button style="width:24px;height:24px">x</button>');
      const violations = await checkTouchTargets(page);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('below 44x44');
      expect(violations[0].effectiveHeight).toBeLessThan(44);
    });

    it('passes a control that meets the size directly', async () => {
      await render('<button style="width:48px;height:48px">x</button>');
      expect(await checkTouchTargets(page)).toEqual([]);
    });

    it('passes a small glyph whose hit area is expanded with padding', async () => {
      // ~8px glyph, padded out to 44x44 without growing the painted mark.
      await render(
        '<button style="padding:12px 18px;border:0;background:none;font-size:16px;line-height:20px">x</button>',
      );
      expect(await checkTouchTargets(page)).toEqual([]);
    });

    it('passes a small glyph with a bounded overlay, which is what the contract allows', async () => {
      await render(`<style>
          .glyph { position: relative; width: 20px; height: 20px; border: 0; background: none; }
          .glyph::after { content: ''; position: absolute; inset: -12px; }
        </style>
        <button class="glyph"></button>`);

      expect(await checkTouchTargets(page)).toEqual([]);
    });

    it('exempts a dense affordance that declares itself one', async () => {
      await render('<button data-touch-target="dense" style="width:20px;height:20px">x</button>');
      expect(await checkTouchTargets(page)).toEqual([]);
    });

    it('honours a custom minimum', async () => {
      await render('<button style="width:32px;height:32px">x</button>');

      expect(await checkTouchTargets(page, { minimum: 44 })).toHaveLength(1);
      expect(await checkTouchTargets(page, { minimum: 24 })).toEqual([]);
    });

    it('ignores controls that are not rendered', async () => {
      await render('<button style="display:none">x</button><button hidden>y</button>');
      expect(await checkTouchTargets(page)).toEqual([]);
    });

    it('names the offending element so it can be found in the source', async () => {
      await render(
        '<button id="save" class="ds-button" style="width:20px;height:20px">Save</button>',
      );

      expect((await checkTouchTargets(page))[0].element).toBe('button#save.ds-button "Save"');
    });
  });

  describe('checkHitAreaOverlap', () => {
    it('flags an overlay that swallows its neighbour', async () => {
      await render(`<style>
          .row { position: relative; display: flex; gap: 4px; align-items: center; }
          .grabby { position: relative; width: 20px; height: 20px; border: 0; }
          .grabby::after { content: ''; position: absolute; inset: -40px; }
          .label { width: 60px; height: 20px; }
        </style>
        <div class="row"><button class="grabby"></button><span class="label">Label</span></div>`);

      const violations = await checkHitAreaOverlap(page);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('hit-area-no-overlap');
      expect(violations[0].covers).toContain('span');
    });

    it('passes an overlay bounded to its own column', async () => {
      await render(`<style>
          .row { display: flex; gap: 8px; align-items: center; }
          .ok { position: relative; width: 44px; height: 44px; border: 0; }
          .label { width: 60px; height: 20px; }
        </style>
        <div class="row"><button class="ok"></button><span class="label">Label</span></div>`);

      expect(await checkHitAreaOverlap(page)).toEqual([]);
    });
  });

  describe('checkFocusVisible', () => {
    it('flags a control that suppresses its focus ring', async () => {
      await render(
        '<button style="width:48px;height:48px;outline:none!important;border:0">x</button>',
      );

      const violations = await checkFocusVisible(page);

      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('focusVisibleRequired');
    });

    it('passes a control with a visible focus ring', async () => {
      await render(`<style>
          button { width: 48px; height: 48px; outline: none; }
          button:focus-visible { outline: 2px solid #000; }
        </style>
        <button>x</button>`);

      expect(await checkFocusVisible(page)).toEqual([]);
    });

    it('accepts a box-shadow ring as well as an outline', async () => {
      await render(`<style>
          button { width: 48px; height: 48px; outline: none; }
          button:focus-visible { box-shadow: 0 0 0 4px #000; }
        </style>
        <button>x</button>`);

      expect(await checkFocusVisible(page)).toEqual([]);
    });
  });

  describe('checkContrast', () => {
    it('flags text that fails WCAG AA', async () => {
      await render(
        '<p style="color:#bbbbbb;background:#ffffff;font-size:14px">Low contrast copy</p>',
      );

      const violations = await checkContrast(page);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].message).toContain('contrastLevel');
    });

    it('passes text that meets it', async () => {
      await render('<p style="color:#000000;background:#ffffff">Readable copy</p>');
      expect(await checkContrast(page)).toEqual([]);
    });

    it('can be scoped away from a subtree', async () => {
      await render(
        '<div id="app"><p style="color:#000;background:#fff">ok</p></div>' +
          '<div id="embed"><p style="color:#bbb;background:#fff;font-size:14px">bad</p></div>',
      );

      expect(await checkContrast(page, { include: '#app' })).toEqual([]);
      expect(await checkContrast(page, { exclude: ['#embed'] })).toEqual([]);
    });
  });

  describe('expectDesignSystemContracts', () => {
    it('throws once, listing every violation it found', async () => {
      await render(`<style>
          button { width: 20px; height: 20px; outline: none !important; border: 0; }
        </style>
        <button>x</button>
        <p style="color:#bbb;background:#fff;font-size:14px">Low contrast</p>`);

      await expect(expectDesignSystemContracts(page)).rejects.toThrow(
        /design system contract violation/,
      );

      const error = await expectDesignSystemContracts(page).catch((caught) => caught);
      expect(error.message).toContain('touch-target-primary');
      expect(error.message).toContain('focusVisibleRequired');
      expect(error.message).toContain('contrastLevel');
    });

    it('resolves on a page that satisfies every contract', async () => {
      await render(`<style>
          button { width: 48px; height: 48px; outline: none; border: 0; background: #ffffff; color: #000000; }
          button:focus-visible { outline: 2px solid #000000; }
        </style>
        <button>Save</button>`);

      await expect(expectDesignSystemContracts(page)).resolves.toEqual([]);
    });

    it('lets an individual check be switched off', async () => {
      await render('<button style="width:20px;height:20px">x</button>');

      await expect(
        expectDesignSystemContracts(page, { touchTargets: false, focusVisible: false }),
      ).resolves.toEqual([]);
    });
  });
});
