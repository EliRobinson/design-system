// These helpers make claims about rendered geometry and computed colour, so
// they are tested in a real browser against fixtures that deliberately violate
// each contract — and against neighbours that satisfy it, since a check that
// fires on everything is worse than no check.
//
// Skipped, loudly, when no browser is available (a bare CI image). The suite is
// the verification; it should not be the thing that blocks an unrelated change.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import { BROWSER_BUDGET, bootBrowser } from './browser.test-helper.mjs';
import {
  checkContrast,
  checkFocusVisible,
  checkHitAreaOverlap,
  checkTouchTargets,
  DENSE_AFFORDANCE_SELECTOR,
  expectDesignSystemContracts,
  MINIMUM_TOUCH_TARGET,
  MINIMUM_TOUCH_TARGET_DENSE,
  PRIMARY_CONTROL_SELECTOR,
} from './playwright.mjs';

/* The `.ds-button--sm` cases below assert against the *shipped* stylesheets
   rather than a hand-written 36px box. An exemption is only ever as good as the
   geometry it exempts, and a fixture that restates `min-height: 36px` inline
   would keep passing if Button.css moved — the one change that should make
   somebody re-open the judgement. Both packages are devDependencies here, so
   these resolve through their export maps. */
const resolveFrom = createRequire(import.meta.url);
const shippedCss = (specifier) => readFileSync(resolveFrom.resolve(specifier), 'utf8');

const { browser, describeBrowser } = await bootBrowser('browser contract tests');

describe('argument handling', () => {
  it('rejects anything that is not a Playwright page', async () => {
    await expect(checkTouchTargets({})).rejects.toThrow(/Playwright Page/);
    await expect(checkFocusVisible(null)).rejects.toThrow(/Playwright Page/);
  });

  it('exports the contract values it enforces', () => {
    expect(MINIMUM_TOUCH_TARGET).toBe(44);
    /* 24 is WCAG 2.2 AA (SC 2.5.8), not a number this system chose, which is
       what makes a second floor a relaxation to the standard rather than a
       discount off it. It also has to agree with --target-min, which is what
       the components size their hit areas from. */
    expect(MINIMUM_TOUCH_TARGET_DENSE).toBe(24);
    expect(PRIMARY_CONTROL_SELECTOR).toContain('button');
  });

  /* The geometry is asserted in the browser below. This is the part that
     survives a bare CI image with no Chromium, where the browser suite skips. */
  it('holds the small button variant to the dense scale', () => {
    expect(DENSE_AFFORDANCE_SELECTOR).toContain('.ds-button--sm');
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

    /* `setContent` replaces the document but does NOT reset the viewport's
       scroll offset, and the offset survives whenever the incoming page is tall
       enough to hold it. So a test that leaves the page scrolled hands the next
       one a viewport already past the fold, and `FILLER` stops putting anything
       below it — measured: scrollY 778 in, 778 out, and the following page's
       trailing element reports `top < clientHeight`.

       Every fold case here depends on that not happening, and the failure is
       order-dependent: green in isolation, red in sequence, with a message
       about the fold rather than about scroll. Reset once, centrally, so no
       individual test has to remember to. */
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  /* Enough filler that whatever follows it cannot be on screen at any plausible
     viewport, so the fold cases below do not quietly stop testing the fold.

     Shared by both fold suites — `checkTouchTargets` (#79/#133) and
     `checkHitAreaOverlap` (#137) — because they assert the same property about
     the same viewport, and a second copy is exactly the drift #137 warns about
     in the checks themselves. */
  const FILLER = '<div style="min-height:200vh"></div>';

  const isBelowTheFold = (selector) =>
    page.evaluate(
      (target) =>
        document.querySelector(target).getBoundingClientRect().top >=
        document.documentElement.clientHeight,
      selector,
    );

  /* Guards the harness itself, not a check. Both fold suites below assume a
     fresh `render()` starts at the top of the document; #137's scroll/restore
     work is what made that assumption load-bearing. */
  describe('the render harness', () => {
    it('starts every page at the top, even after the previous one scrolled', async () => {
      await render(`${FILLER}<p id="scrolled-to">bottom</p>`);
      await page.evaluate(() =>
        document.querySelector('#scrolled-to').scrollIntoView({ block: 'center' }),
      );
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

      await render(`${FILLER}<p id="fresh">next test</p>`);

      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      /* The property the fold cases actually rely on. Asserted separately from
         scrollY because this is the one that breaks them. */
      expect(await isBelowTheFold('#fresh')).toBe(true);
    });
  });

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

    /* Issue #116, and a deliberate contract change rather than a test fix.
       This fixture used to assert that a self-declared dense affordance at
       20x20 *passed* — which was true, and was the bug: `dense` meant "stop
       looking", so an 8x8 tap target with the attribute on it passed as
       cleanly as a 36px button. `dense` now means "measured against 24x24, the
       WCAG 2.2 AA floor", so the same fixture is red by construction. The pair
       below pins both halves: 20x20 fails, 24x24 passes. */
    describe('a dense affordance, which is measured against the dense floor', () => {
      it('flags one below 24x24, which used to be an unconditional pass', async () => {
        await render('<button data-touch-target="dense" style="width:20px;height:20px">x</button>');
        const violations = await checkTouchTargets(page);

        expect(violations).toHaveLength(1);
        expect(violations[0].contract).toBe('touch-target-dense');
        expect(violations[0].minimum).toBe(MINIMUM_TOUCH_TARGET_DENSE);
        expect(violations[0].message).toContain('below 24x24');
        expect(violations[0].message).toContain('dense floor');
      });

      it('passes one that clears 24x24 without going anywhere near 44', async () => {
        await render('<button data-touch-target="dense" style="width:24px;height:24px">x</button>');
        expect(await checkTouchTargets(page)).toEqual([]);
      });

      /* The floor is a floor, not a second exemption: the message has to name
         which of the two was applied, or a reader cannot tell whether ~22x22
         is a bug or a non-event, and it must not offer `dense` as the fix to a
         control that is already dense. */
      it('does not offer the dense marker as a remedy to a control that already has it', async () => {
        await render('<button data-touch-target="dense" style="width:20px;height:20px">x</button>');
        const [violation] = await checkTouchTargets(page);

        expect(violation.message).not.toContain('declares itself with data-touch-target');
        expect(violation.message).toContain('no marker below this one');
      });

      /* A primary control's advice does still name the marker — and now has to
         say what it buys, which is a lower floor and not silence. */
      it('tells a primary control that declaring itself dense still leaves a floor', async () => {
        await render('<button style="width:20px;height:20px">x</button>');
        const [violation] = await checkTouchTargets(page);

        expect(violation.contract).toBe('touch-target-primary');
        expect(violation.minimum).toBe(MINIMUM_TOUCH_TARGET);
        expect(violation.message).toContain('data-touch-target="dense"');
        expect(violation.message).toContain('24x24 dense floor');
        expect(violation.message).toContain('not a way to stop the control being measured');
      });

      it('holds the dense floor to `minimum` when a caller loosens the contract below 24', async () => {
        await render('<button data-touch-target="dense" style="width:20px;height:20px">x</button>');

        /* A relaxation cannot come out stricter than the floor it relaxes: a
           caller who has said 20 is enough for a page's primary CTA cannot
           have meant 24 for its chip glyphs. */
        expect(await checkTouchTargets(page, { minimum: 20 })).toEqual([]);
      });

      it('measures a dense affordance against `minimum` when `exempt` is cleared', async () => {
        await render('<button data-touch-target="dense" style="width:32px;height:32px">x</button>');

        expect(await checkTouchTargets(page)).toEqual([]);
        const [violation] = await checkTouchTargets(page, { exempt: '' });
        expect(violation.contract).toBe('touch-target-primary');
      });
    });

    /* Rating's real shape. The exemption used to name `.ds-rating__star`,
       which is the glyph inside the button, so it matched nothing and the
       control it was written for failed anyway. Asserted against the markup
       rather than the string, because a class list is only as good as the
       elements it lands on. */
    it('tiers a dense affordance by its shipped class, on the element that takes the click', async () => {
      await render(
        '<div class="ds-rating">' +
          '<button class="ds-rating__button" style="width:32px;height:32px">' +
          '<span class="ds-rating__star" aria-hidden="true">★</span>' +
          '</button></div>',
      );

      expect(await checkTouchTargets(page)).toEqual([]);
    });

    /* Issue #113. `size="sm"` is a sanctioned dense variant at 36px, and the
       element a consumer ships it on is often an anchor carrying the classes
       (`<a class="ds-button ds-button--sm">` in a site header) rather than the
       React component's <button>. The exemption is keyed off the class for
       exactly that reason, so both shapes are asserted here — a rule that only
       covered the component would not have covered the reported bug.

       These render the real Button.css over the real tokens.css: nothing is
       restated inline, so the 36px being exempted is the 36px that ships. */
    describe('the small button variant, which is dense by design', () => {
      async function renderShipped(body) {
        await page.setContent(
          `<!doctype html><html><head><style>* { box-sizing: border-box; margin: 0; }` +
            `body { background: #ffffff; color: #000000; font: 16px system-ui; padding: 40px; }</style>` +
            `<style>${shippedCss('@elirobinson/tokens/tokens.css')}</style>` +
            `<style>${shippedCss('@elirobinson/react/styles/atoms/Button.css')}</style>` +
            `</head><body>${body}</body></html>`,
        );
      }

      it('is still under the 44px floor, which is the thing being re-tiered', async () => {
        await renderShipped(
          '<a class="ds-button ds-button--accent ds-button--sm" href="#">Hire Me</a>',
        );

        const height = await page.evaluate(
          () => document.querySelector('.ds-button--sm').getBoundingClientRect().height,
        );

        expect(height).toBeLessThan(MINIMUM_TOUCH_TARGET);
      });

      it('passes on the anchor carrying the classes, which is how the bug was reported', async () => {
        await renderShipped(
          '<a class="ds-button ds-button--accent ds-button--sm" href="#">Hire Me</a>',
        );

        expect(await checkTouchTargets(page)).toEqual([]);
      });

      it('passes on the <button> the React component renders', async () => {
        await renderShipped(
          '<button class="ds-button ds-button--primary ds-button--sm">Save</button>',
        );

        expect(await checkTouchTargets(page)).toEqual([]);
      });

      /* The half that matters. Re-tiering a named variant must not become a
         blanket pass — an undersized control that has claimed nothing about
         itself is still a violation, and a default-size .ds-button that has
         been squashed is still a violation. */
      it('does not re-tier an undersized control that declares nothing', async () => {
        await renderShipped(
          '<a class="ds-button ds-button--accent ds-button--sm" href="#">Hire Me</a>' +
            '<button style="width:24px;height:24px">x</button>',
        );

        const violations = await checkTouchTargets(page);

        expect(violations).toHaveLength(1);
        expect(violations[0].element).not.toContain('ds-button--sm');
      });

      it('does not re-tier a default-size .ds-button that has been squashed', async () => {
        await renderShipped(
          '<button class="ds-button ds-button--primary" style="min-height:24px;padding:0">Save</button>',
        );

        expect(await checkTouchTargets(page)).toHaveLength(1);
      });
    });

    /* Issue #116's blocking finding: `.ds-chip__remove` was the one thing the
       system shipped under the dense floor — 22x22 painted and 22x22 effective,
       2px short in both axes. The fix keeps the 22px painted glyph (MUI's own
       delete-icon scale) and reaches --target-min through a bounded overlay, so
       both halves have to be asserted: the reach, and the absence of an
       overlap. Asserting a bounded overlay's *size* without asserting what it
       covers is how the 44x44 chip overlay that swallowed its own label got
       shipped in the first place — which is the failure hit-area-no-overlap
       exists for, and which OVERLAP_MESSAGE tells consumers to avoid.

       Against the shipped Chip.css over the shipped tokens.css, for the same
       reason the .ds-button--sm cases are: a fixture restating the geometry
       inline would keep passing after the stylesheet moved. */
    describe("the chip's remove glyph, which reaches the dense floor without repainting", () => {
      async function renderChip(body) {
        await page.setContent(
          `<!doctype html><html><head><style>* { box-sizing: border-box; margin: 0; }` +
            `body { background: #ffffff; color: #000000; font: 16px system-ui; padding: 40px; }</style>` +
            `<style>${shippedCss('@elirobinson/tokens/tokens.css')}</style>` +
            `<style>${shippedCss('@elirobinson/react/styles/molecules/Chip.css')}</style>` +
            `</head><body>${body}</body></html>`,
        );
      }

      const CHIP =
        '<span class="ds-chip"><span class="ds-chip__label">Design</span>' +
        '<button type="button" class="ds-chip__remove" aria-label="Remove Design">&times;</button></span>';

      it('still paints 22px, which is the point of keeping it dense', async () => {
        await renderChip(CHIP);

        const painted = await page.evaluate(() => {
          const { width, height } = document
            .querySelector('.ds-chip__remove')
            .getBoundingClientRect();
          return { width, height };
        });

        expect(painted).toEqual({ width: 22, height: 22 });
      });

      it('passes the dense floor on its hit area, not on its paint', async () => {
        await renderChip(CHIP);
        expect(await checkTouchTargets(page)).toEqual([]);
      });

      /* The measurement, not just the verdict: 22px of paint has to be
         reporting >= 24 of reach, or this is passing for some other reason. */
      it('reaches at least 24x24', async () => {
        await renderChip(CHIP);

        /* No floor can be cleared at 200, so the violation carries the number.
           `exempt: ''` because the reach is the question, not the tier. */
        const [measured] = await checkTouchTargets(page, { exempt: '', minimum: 200 });

        expect(measured.effectiveWidth).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_DENSE);
        expect(measured.effectiveHeight).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_DENSE);
      });

      it('covers nothing — the overlay is bounded, which is the constraint on the fix', async () => {
        await renderChip(CHIP);
        expect(await checkHitAreaOverlap(page)).toEqual([]);
      });

      /* The overlap headroom shrinks with the label, so the shortest chip the
         system can render is the case that would break first. */
      /* Issue #114. `<a class="ds-chip">` and `<button class="ds-chip">` are
         sanctioned hand-written usages — tokens.css strips their underline on
         purpose and components.md says a chip that is an anchor is a control —
         but <Chip> renders a <span>, so no fixture in this repo has ever
         rendered one and both failed the 44px floor latently, for consumers
         only. They are dense at 32px (MUI's Chip exactly, which is the scale
         this tier already cites) and clear 24 at 64x32.

         What #114 objected to about this answer was that adding `.ds-chip`
         here used to mean *not measuring* a control. It no longer does, which
         is why the entry lands in this PR and not that issue. */
      it('holds a chip that is a control to the dense floor, which it clears', async () => {
        await renderChip(
          '<a class="ds-chip" href="#">Design</a><button class="ds-chip">Filter</button>',
        );

        expect(await checkTouchTargets(page)).toEqual([]);
      });

      it('still fails a chip control that is squashed below the dense floor', async () => {
        await renderChip('<a class="ds-chip" href="#" style="min-height:20px">Design</a>');

        const [violation] = await checkTouchTargets(page);
        expect(violation.contract).toBe('touch-target-dense');
      });

      it('covers nothing on a one-character chip either', async () => {
        await renderChip(
          '<span class="ds-chip"><span class="ds-chip__label">A</span>' +
            '<button type="button" class="ds-chip__remove" aria-label="Remove A">&times;</button></span>',
        );

        expect(await checkHitAreaOverlap(page)).toEqual([]);
        expect(await checkTouchTargets(page)).toEqual([]);
      });
    });

    /* The table's sort toggle is the only element in the repo that carries
       data-touch-target="dense", so it is the only shipped element whose floor
       this change moves. It used to clear 24 by 0.45px of inline-box bleed over
       a 23.09px font-derived box, with no min-height of its own — passing by
       accident is not the same as passing, and the next line-height change
       would have turned it red. */
    describe("the table's sort toggle, whose floor is now in CSS", () => {
      it('is at least --target-min tall from the stylesheet, not from its font', async () => {
        await page.setContent(
          `<!doctype html><html><head><style>* { box-sizing: border-box; margin: 0; }` +
            `body { background: #ffffff; color: #000000; font: 16px system-ui; padding: 40px; }</style>` +
            `<style>${shippedCss('@elirobinson/tokens/tokens.css')}</style>` +
            `<style>${shippedCss('@elirobinson/react/styles/organisms/table/core.css')}</style>` +
            `</head><body><table class="ds-table"><thead><tr><th>` +
            `<button type="button" data-touch-target="dense" class="ds-table__sort">` +
            `<span>Name</span><span class="ds-table__sort-icon" aria-hidden="true">&#8597;</span>` +
            `</button></th></tr></thead></table></body></html>`,
        );

        const height = await page.evaluate(
          () => document.querySelector('.ds-table__sort').getBoundingClientRect().height,
        );

        expect(height).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET_DENSE);
        expect(await checkTouchTargets(page)).toEqual([]);
      });
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

    /* Issue #79. `document.elementFromPoint` only answers for the visible
       viewport, so every probe on a control below the fold came back `null`,
       `reach` returned 0 in all four directions, and `0 + 0 + 1` reported a
       literal "1x1" — the same "1x1" for a compliant control and for a
       genuinely undersized one. Any page taller than the viewport failed, and
       nothing below the fold was ever actually measured. */
    describe('controls below the fold', () => {
      it('passes a correctly sized control that is below the fold', async () => {
        await render(`${FILLER}<button id="t" style="width:112px;height:44px">Open phase</button>`);

        expect(await isBelowTheFold('#t')).toBe(true);
        expect(await checkTouchTargets(page)).toEqual([]);
      });

      /* The half that matters. Scrolling into view must not turn into a
         blanket pass: an undersized control below the fold is exactly the
         thing the old implementation could not distinguish from a compliant
         one, and it still has to be reported. */
      it('still reports an undersized control that is below the fold', async () => {
        await render(`${FILLER}<button id="t" style="width:24px;height:24px">x</button>`);

        expect(await isBelowTheFold('#t')).toBe(true);

        const violations = await checkTouchTargets(page);

        expect(violations).toHaveLength(1);
        expect(violations[0].element).toBe('button#t "x"');
        expect(violations[0].effectiveWidth).toBeLessThan(44);
        expect(violations[0].effectiveHeight).toBeLessThan(44);
      });

      /* The padded-glyph case from above, moved below the fold: the fix has to
         restore the real *effective* measurement down there, not just the
         painted box. */
      it('passes a padded glyph below the fold, measuring its hit area not its box', async () => {
        await render(
          `${FILLER}<button id="t" style="padding:12px 18px;border:0;background:none;` +
            `font-size:16px;line-height:20px">x</button>`,
        );

        expect(await isBelowTheFold('#t')).toBe(true);
        expect(await checkTouchTargets(page)).toEqual([]);
      });

      /* A surface larger than the window cannot be walked to its edge — the
         probe leaves the viewport before it runs out of control. It also
         plainly clears 44px, so it passes on its painted geometry rather than
         failing for being too big to probe. */
      it('passes a control taller than the viewport', async () => {
        await render(
          `${FILLER}<a id="t" href="#" style="display:block;width:44px;height:200vh"></a>`,
        );

        expect(await checkTouchTargets(page)).toEqual([]);
      });

      /* The check runs inside somebody else's test, in front of somebody
         else's screenshot. Where it leaves the page is part of its contract. */
      it('puts the page back where it found it', async () => {
        await render(`${FILLER}<button id="t" style="width:112px;height:44px">Open phase</button>`);

        await page.evaluate(() => window.scrollTo(0, 120));
        await checkTouchTargets(page);

        expect(await page.evaluate(() => window.scrollY)).toBe(120);
      });

      it('leaves a scrollable container where it found it', async () => {
        await render(`<div id="pane" style="height:120px;overflow:auto">
            <div style="height:1200px"></div>
            <button style="width:112px;height:44px">Deep</button>
          </div>`);

        await page.evaluate(() => {
          document.getElementById('pane').scrollTop = 40;
        });
        await checkTouchTargets(page);

        expect(await page.evaluate(() => document.getElementById('pane').scrollTop)).toBe(40);
      });
    });

    /* Belt and braces. A `null` from `elementFromPoint` means "the browser
       routed nothing here", which is not a size — turning it into one is the
       whole of #79. Out-of-viewport coordinates are now refused before the
       call, and for a point inside the viewport Chromium answers with the root
       element rather than `null` (even under `pointer-events: none`, which was
       the obvious candidate — it returns <html>). So this guard covers a case
       the browser is not supposed to produce, and the only way to reach it is
       to make the browser produce it. Stubbing here asserts the guard, not the
       browser: the thing being pinned is that an unobtainable measurement is
       reported as unobtainable and never as a size. */
    describe('controls the check cannot measure', () => {
      it('reports a distinct diagnostic rather than a size violation', async () => {
        await render('<button style="width:112px;height:44px">Unreachable</button>');

        let violations;
        try {
          /* An own property shadowing Document.prototype's method, so the
             `delete` below puts the real one back. `setContent` reuses the
             same document object, so a stub left behind would follow this
             page into every later test in the file. */
          await page.evaluate(() => {
            document.elementFromPoint = () => null;
          });
          violations = await checkTouchTargets(page);
        } finally {
          await page.evaluate(() => {
            delete document.elementFromPoint;
          });
        }

        expect(violations).toHaveLength(1);
        expect(violations[0].unmeasurable).toBe(true);
        expect(violations[0].message).toContain('touch-target-unmeasurable');
        expect(violations[0].message).toContain('not a size violation');
        expect(violations[0].effectiveWidth).toBeUndefined();
        expect(violations[0].effectiveHeight).toBeUndefined();
        /* The painted box was obtained, so it is reported; the hit area was
           not, so it is not. */
        expect(violations[0].width).toBe(112);
        expect(violations[0].height).toBe(44);
      });

      /* A control deliberately parked out of the document's view — the
         visually-hidden skip link every site ships — is not a gap in the
         check. It is unreachable by design and stays silent. */
      it('says nothing about a control parked off-canvas on purpose', async () => {
        await render(
          '<a href="#main" style="position:absolute;top:-64px;left:0;width:120px;height:24px">Skip to content</a>',
        );

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

    /* `sr-only` is 1x1, not 0x0 — a genuinely zero-sized element is dropped
       from the accessibility tree in some browsers — so it slipped the old
       `width === 0 || height === 0` guard by exactly one pixel. Sitting at its
       control's static origin, its centre lands on the control, and every
       accessible-name-only label on the page came back as a swallowed
       neighbour. 23 such pairs on one consumer page. */
    it('passes a control whose only sibling is an sr-only label', async () => {
      await render(`<style>
          .sr-only {
            position: absolute;
            width: 1px; height: 1px;
            padding: 0; margin: -1px;
            overflow: hidden;
            clip-path: inset(50%);
            white-space: nowrap; border: 0;
          }
          .row { position: relative; display: flex; align-items: center; }
          .box { width: 18px; height: 18px; }
        </style>
        <div class="row">
          <input class="box" id="done" type="checkbox" />
          <label class="sr-only" for="done">Mark task done</label>
        </div>`);

      expect(await checkHitAreaOverlap(page)).toEqual([]);
    });

    /* The property worth protecting: skipping invisible siblings must not
       blunt the check for a real one. Same symmetric negative-inset overlay as
       the first case, with a sibling the user can actually see. */
    it('still flags a symmetric negative-inset overlay covering a visible sibling', async () => {
      await render(`<style>
          .row { position: relative; display: flex; gap: 4px; align-items: center; }
          .grabby { position: relative; width: 20px; height: 20px; border: 0; }
          .grabby::after { content: ''; position: absolute; inset: -40px; }
          .label { width: 60px; height: 20px; }
        </style>
        <div class="row">
          <button class="grabby"></button>
          <span class="label">Visible label</span>
        </div>`);

      const violations = await checkHitAreaOverlap(page);

      expect(violations).toHaveLength(1);
      expect(violations[0].covers).toContain('span.label');
    });

    /* Issue #137, the same defect #79/#133 fixed in `checkTouchTargets` and
       left alone here so that PR stayed one function wide.
       `document.elementFromPoint` only answers for the visible viewport, so a
       sibling past the fold was probed at a coordinate the browser cannot see.
       It answered `null`, `null` is neither the control nor contained by it,
       both branches were false, and the loop moved on having established
       nothing — a silent false negative on every page taller than the window,
       which is the normal case rather than the edge case. */
    describe('siblings below the fold', () => {
      /* The bug itself. Byte-for-byte the visible-sibling fixture above, moved
         past the fold — so this passing can only ever mean the probe never ran.

         It is also the test the issue asks for in place of an assumption:
         scrolling moves the *sibling* into view, and this only reports if the
         control is still on top of it afterwards. Sharing a parent is what
         makes that true, and the loop only ever walks
         `control.parentElement.children`. */
      it('flags an overlay that swallows a visible sibling below the fold', async () => {
        await render(`<style>
            .row { position: relative; display: flex; gap: 4px; align-items: center; }
            .grabby { position: relative; width: 20px; height: 20px; border: 0; }
            .grabby::after { content: ''; position: absolute; inset: -40px; }
            .label { width: 60px; height: 20px; }
          </style>
          ${FILLER}
          <div class="row">
            <button class="grabby"></button>
            <span class="label">Visible label</span>
          </div>`);

        expect(await isBelowTheFold('.label')).toBe(true);

        const violations = await checkHitAreaOverlap(page);

        expect(violations).toHaveLength(1);
        expect(violations[0].message).toContain('hit-area-no-overlap');
        expect(violations[0].covers).toContain('span.label');
      });

      /* The other half. Reaching the sibling must not reintroduce what #131
         removed: `sr-only` is 1x1, sits at its control's static origin, and its
         centre therefore routes to the control — so anything that probes it at
         all reports every accessible-name-only label on the page. Scrolling
         gave the check far more siblings to be wrong about, so the case is
         asserted below the fold as well as above it.

         #137 asks for the visibility guard and the scroll to have their
         ordering pinned here. Measured instead: running the guard after the
         scroll leaves this suite entirely green, because every clause of it
         reads dimensions and computed style, which a scroll does not change.
         The order is a cost decision, and there is no hazard to pin — recorded
         so the next reader does not go looking for one. What this does pin is
         that the guard survives the fix at all. */
      it('passes an sr-only sibling below the fold', async () => {
        await render(`<style>
            .sr-only {
              position: absolute;
              width: 1px; height: 1px;
              padding: 0; margin: -1px;
              overflow: hidden;
              clip-path: inset(50%);
              white-space: nowrap; border: 0;
            }
            .row { position: relative; display: flex; align-items: center; }
            .box { width: 18px; height: 18px; }
          </style>
          ${FILLER}
          <div class="row">
            <input class="box" id="done" type="checkbox" />
            <label class="sr-only" for="done">Mark task done</label>
          </div>`);

        expect(await isBelowTheFold('.sr-only')).toBe(true);
        expect(await checkHitAreaOverlap(page)).toEqual([]);
      });

      /* The call #137 asks to make rather than inherit. `checkTouchTargets`
         lets a surface too large to walk pass on its painted geometry, because
         the question there is "is this box big enough" and an oversized box
         plainly is. The question here is "is this sibling covered", and being
         tall is no reason to stop asking — so an oversized sibling is probed at
         the centre of whatever part of it is on screen, and a control sitting
         on that point is still reported.

         `scrollIntoView({ block: 'center' })` can usually bring even an
         oversized element's true centre on screen; the on-screen midpoint is
         what answers when the document's scroll range runs out first. */
      it('flags an overlay covering a sibling taller than the viewport', async () => {
        await render(`<style>
            .row { position: relative; display: flex; gap: 4px; align-items: flex-start; }
            .grabby { position: relative; width: 20px; height: 20px; border: 0; }
            .grabby::after { content: ''; position: absolute; inset: -400vh -40px; }
            .tall { width: 60px; height: 300vh; background: #eeeeee; }
          </style>
          ${FILLER}
          <div class="row">
            <button class="grabby"></button>
            <span class="tall">Tall neighbour</span>
          </div>`);

        const violations = await checkHitAreaOverlap(page);

        expect(violations).toHaveLength(1);
        expect(violations[0].covers).toContain('span.tall');
      });

      /* Reaching a sibling now means scrolling, and this check runs inside
         somebody else's test, in front of somebody else's screenshot. Where it
         leaves the page is part of its contract — the same one
         `checkTouchTargets` holds itself to.

         This asserts the contract, not a line: the window scroll is restored
         twice over, because <html> is itself a scrollable node and so is in the
         container snapshot, *and* `window.scrollTo` names it directly. Deleting
         either one on its own leaves this green; deleting both turns it red.
         Both are kept — the pair mirrors `checkTouchTargets`, and a page whose
         scrolling element is <body> would not be in the snapshot. */
      it('puts the page back where it found it', async () => {
        await render(`<style>
            .row { position: relative; display: flex; gap: 4px; align-items: center; }
            .grabby { position: relative; width: 20px; height: 20px; border: 0; }
            .grabby::after { content: ''; position: absolute; inset: -40px; }
            .label { width: 60px; height: 20px; }
          </style>
          ${FILLER}
          <div class="row">
            <button class="grabby"></button>
            <span class="label">Visible label</span>
          </div>`);

        await page.evaluate(() => window.scrollTo(0, 120));
        await checkHitAreaOverlap(page);

        expect(await page.evaluate(() => window.scrollY)).toBe(120);
      });

      /* `scrollIntoView` walks the whole ancestor chain, so restoring the
         window alone would still leave a scrollable container somewhere new. */
      it('leaves a scrollable container where it found it', async () => {
        await render(`<style>
            .row { position: relative; display: flex; gap: 4px; align-items: center; }
            .grabby { position: relative; width: 20px; height: 20px; border: 0; }
            .grabby::after { content: ''; position: absolute; inset: -40px; }
            .label { width: 60px; height: 20px; }
          </style>
          <div id="pane" style="height:120px;overflow:auto">
            <div style="height:1200px"></div>
            <div class="row">
              <button class="grabby"></button>
              <span class="label">Deep label</span>
            </div>
          </div>`);

        await page.evaluate(() => {
          document.getElementById('pane').scrollTop = 40;
        });
        await checkHitAreaOverlap(page);

        expect(await page.evaluate(() => document.getElementById('pane').scrollTop)).toBe(40);
      });
    });

    /* The same belt-and-braces guard `checkTouchTargets` carries, for the same
       reason. Once the probe is scrolled into view a `null` cannot mean "below
       the fold" any more, and Chromium answers an on-screen point with the root
       element rather than `null` — so the only way to reach this is to make the
       browser produce it. What is being pinned is that a probe which failed is
       reported as a gap rather than silently counted as "not covered", which is
       the shape of #137 itself. */
    describe('siblings the check cannot probe', () => {
      it('reports a distinct diagnostic rather than staying silent', async () => {
        await render(`<style>
            .row { position: relative; display: flex; gap: 4px; align-items: center; }
            .grabby { position: relative; width: 20px; height: 20px; border: 0; }
            .grabby::after { content: ''; position: absolute; inset: -40px; }
            .label { width: 60px; height: 20px; }
          </style>
          <div class="row">
            <button class="grabby"></button>
            <span class="label">Visible label</span>
          </div>`);

        let violations;
        try {
          /* An own property shadowing Document.prototype's method, so the
             `delete` below puts the real one back. `setContent` reuses the same
             document object, so a stub left behind would follow this page into
             every later test in the file. */
          await page.evaluate(() => {
            document.elementFromPoint = () => null;
          });
          violations = await checkHitAreaOverlap(page);
        } finally {
          await page.evaluate(() => {
            delete document.elementFromPoint;
          });
        }

        expect(violations).toHaveLength(1);
        expect(violations[0].unmeasurable).toBe(true);
        expect(violations[0].message).toContain('hit-area-unmeasurable');
        expect(violations[0].message).toContain('not a violation');
        expect(violations[0].covers).toContain('span.label');
      });

      /* A sibling parked out of the document's view — the visually-hidden skip
         link every site ships — is not a gap. Scrolling cannot bring back what
         is positioned off-canvas, and nothing a user cannot reach can be
         covered, so it stays silent rather than becoming unmeasurable noise. */
      it('says nothing about a sibling parked off-canvas on purpose', async () => {
        await render(`<div style="position:relative">
            <button style="width:44px;height:44px">Menu</button>
            <a href="#main" style="position:absolute;top:-100px;left:0;width:120px;height:24px">Skip to content</a>
          </div>`);

        expect(await checkHitAreaOverlap(page)).toEqual([]);
      });
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
