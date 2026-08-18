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

/* Starting, opening and closing Chromium are process-level operations that
   share the machine with whatever else is running. Vitest's 10s hook budget is
   sized for a unit test's setup, and `browser.close()` went past it whenever
   this file ran alongside a build — failing a suite in which all 21 assertions
   had already passed, which is the worst kind of red: it says nothing about the
   code and everything about the machine. Measured here: launch 435ms, newPage
   128ms, close 22ms idle; under a parallel monorepo build, close alone blew
   through 10s in three runs out of four. The budget below is for the browser,
   not for the assertions — those stay on the default, and none of them came
   within 200ms of it even under that load. */
const BROWSER_BUDGET = 60_000;

/* 60s is a bigger number, not a different mechanism — a CI runner slow enough
   could still blow it, and the same "all assertions passed, then the file
   went red" failure would recur. The actual fix would be treating teardown
   failure as non-fatal once every assertion has already run; Vitest has no
   first-class way to say that, so this budget is the mitigation until either
   that changes or this proves not to be enough. */

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
    browser = await launchWithin(BROWSER_BUDGET);
  } catch (error) {
    launchError = error;
  }
}

/**
 * Launch, or give up loudly.
 *
 * The launch runs during collection, where no timeout applies at all, so a
 * browser that never comes up would hang the run rather than skip it. A
 * late-arriving browser is closed instead of left parented to a worker that has
 * already moved on.
 */
async function launchWithin(budget) {
  const launch = chromium.launch();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`chromium.launch() exceeded ${budget}ms`)), budget);
  });

  try {
    const launched = await Promise.race([launch, deadline]);
    clearTimeout(timer);
    return launched;
  } catch (error) {
    clearTimeout(timer);
    /* Still in flight, and now nobody is waiting for it. Close it if it lands
       so the run does not leave an orphaned Chromium behind; the catch also
       keeps a rejected launch from surfacing as an unhandled rejection. */
    launch.then((late) => late.close()).catch(() => {});
    throw error;
  }
}

afterAll(async () => {
  await browser?.close();
}, BROWSER_BUDGET);

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
  }, BROWSER_BUDGET);

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

    /* Rating's real shape. The exemption used to name `.ds-rating__star`,
       which is the glyph inside the button, so it matched nothing and the
       control it was written for failed anyway. Asserted against the markup
       rather than the string, because a class list is only as good as the
       elements it lands on. */
    it('exempts a dense affordance by its shipped class, on the element that takes the click', async () => {
      await render(
        '<div class="ds-rating">' +
          '<button class="ds-rating__button" style="width:32px;height:32px">' +
          '<span class="ds-rating__star" aria-hidden="true">★</span>' +
          '</button></div>',
      );

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

    /* A small native input beside a real text label is the standard checkbox
       pattern, and measuring the 18x18 box measures something nobody aims at.
       These four cases fix the boundary: the label rescues the control only
       when the label is itself a 44x44 surface. */
    describe('labelled controls', () => {
      it('passes a small input whose label is a target in its own right', async () => {
        await render(`<style>
            .row { align-items: center; display: flex; gap: 12px; }
            .box { height: 18px; width: 18px; }
            .text { align-self: stretch; display: flex; align-items: center; min-height: 44px; }
          </style>
          <div class="row">
            <input id="c" type="checkbox" class="box">
            <label for="c" class="text">Email updates</label>
          </div>`);

        expect(await checkTouchTargets(page)).toEqual([]);
      });

      it('passes when the label wraps the control instead of pointing at it', async () => {
        await render(`<style>
            .row { align-items: center; display: flex; gap: 12px; min-height: 44px; }
            .box { height: 18px; width: 18px; }
          </style>
          <label class="row"><input type="checkbox" class="box"><span>Email updates</span></label>`);

        expect(await checkTouchTargets(page)).toEqual([]);
      });

      /* The whole point of the rule. A 20px-tall run of text next to an 18px
         box is what the system shipped, and it is not a 44px target — if this
         passed, the check would be blind to every under-sized checkbox. */
      it('still flags a small input whose label is only a sliver of text', async () => {
        await render(`<style>
            .row { align-items: center; display: flex; gap: 12px; min-height: 44px; }
            .box { height: 18px; width: 18px; }
            .text { font-size: 14px; line-height: 20px; }
          </style>
          <div class="row">
            <input id="c" type="checkbox" class="box">
            <label for="c" class="text">Email updates</label>
          </div>`);

        const violations = await checkTouchTargets(page);

        expect(violations).toHaveLength(1);
        expect(violations[0].effectiveHeight).toBe(18);
        expect(violations[0].labelHeight).toBeLessThan(44);
        expect(violations[0].message).toContain('its label is only');
      });

      it('still flags a small input with no label at all', async () => {
        await render('<input type="checkbox" style="width:18px;height:18px">');

        const violations = await checkTouchTargets(page);

        expect(violations).toHaveLength(1);
        expect(violations[0].labelWidth).toBeUndefined();
        expect(violations[0].message).not.toContain('its label');
      });

      /* An input and a label 12px apart are two surfaces, not one 44px one.
         Adding their bounding boxes together would pass every checkbox ever
         written, which is why the rule takes the largest single surface. */
      it('does not add a control and its label together into one target', async () => {
        await render(`<style>
            .row { align-items: center; display: flex; gap: 12px; }
            .box { height: 40px; width: 20px; }
            .text { height: 40px; width: 200px; }
          </style>
          <div class="row">
            <input id="c" type="checkbox" class="box">
            <label for="c" class="text">Wide but short</label>
          </div>`);

        expect(await checkTouchTargets(page)).toHaveLength(1);
      });
    });

    /* Chromium attributes a hit over a modal's ::backdrop to the <dialog>, so
       every control behind an open dialog measured ~1x1 — the walk starts at
       ±1px and never tests the centre, so it could not tell "tiny" from
       "nothing routes here". It then advised padding on compliant controls. */
    describe('occluded controls', () => {
      it('skips a compliant control sitting behind an open modal dialog', async () => {
        await render(`<dialog id="d"><p>Panel</p></dialog>
          <button style="width:186px;height:44px">Open command palette</button>`);
        await page.evaluate(() => document.getElementById('d').showModal());

        expect(await checkTouchTargets(page)).toEqual([]);
      });

      it('still flags an under-sized control once the modal is closed', async () => {
        await render(`<dialog id="d"><p>Panel</p></dialog>
          <button style="width:20px;height:20px">x</button>`);
        await page.evaluate(() => document.getElementById('d').showModal());
        expect(await checkTouchTargets(page)).toEqual([]);

        await page.evaluate(() => document.getElementById('d').close());
        expect(await checkTouchTargets(page)).toHaveLength(1);
      });

      it('skips a control covered by an ordinary overlay, rather than calling it 1x1', async () => {
        await render(`<style>
            .cover { position: fixed; inset: 0; background: rgba(0,0,0,0.5); }
          </style>
          <button style="width:186px;height:44px">Under the sheet</button>
          <div class="cover"></div>`);

        expect(await checkTouchTargets(page)).toEqual([]);
      });
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

    /* Same root cause as the 1x1 touch target: a control behind an open modal
       is inert, `.focus()` is a no-op, and the before/after snapshots match
       for the trivial reason that focus never moved — reporting a missing
       ring on a control that has one. */
    it('skips a control the browser refuses to focus', async () => {
      await render(`<style>
          button { width: 48px; height: 48px; outline: none; }
          button:focus-visible { outline: 2px solid #000; }
        </style>
        <dialog id="d"><input id="inside"></dialog>
        <button>Open command palette</button>`);
      await page.evaluate(() => document.getElementById('d').showModal());

      expect(await checkFocusVisible(page)).toEqual([]);
    });

    it('still flags a ringless control once the modal is closed', async () => {
      await render(`<style>
          button { width: 48px; height: 48px; outline: none !important; border: 0; }
        </style>
        <dialog id="d"><input id="inside"></dialog>
        <button>x</button>`);
      await page.evaluate(() => document.getElementById('d').showModal());
      expect(await checkFocusVisible(page)).toEqual([]);

      await page.evaluate(() => document.getElementById('d').close());
      expect(await checkFocusVisible(page)).toHaveLength(1);
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
