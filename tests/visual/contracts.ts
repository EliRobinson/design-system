import { expect, type Page } from '@playwright/test';

import {
  PRIMARY_CONTROL_SELECTOR,
  expectDesignSystemContracts,
} from '@elirobinson/ai-patterns/testing/playwright';

/* We publish these checks for consumers to run against their own app, where
   every button on the page is theirs. Pointed at a Storybook iframe they also
   pick up the framework's chrome, and pointed at a docs page they pick up
   editorial prose — an inline link in body copy is ~89x18, which is not what
   the 44px rule is about. Unscoped, one sample of twenty pages produced 530
   touch-target and 97 contrast violations, essentially none of them ours.

   Scoping every selector to the story root leaves only the component under
   test. The same sweep then reports 0 contrast and 0 hit-area violations
   across all 84 stories in both themes — which is why those two run here as
   real assertions rather than as noise. */
const STORY_ROOT = '#storybook-root';

const scopedControls = PRIMARY_CONTROL_SELECTOR.split(', ')
  .map((selector) => `${STORY_ROOT} ${selector}`)
  .join(', ');

/** Runs the browser-settled contracts against the story currently rendered.
 *
 *  Must be called *after* the screenshot assertion: checkFocusVisible focuses
 *  controls to see whether anything changes, so running it first would put a
 *  focus ring into the baseline. */
export async function assertContracts(page: Page): Promise<void> {
  await expectDesignSystemContracts(page, {
    hitAreaOverlap: { selector: scopedControls },
    contrast: { include: STORY_ROOT },

    /* Both off pending decisions recorded in issue #65 — turning them on today
       would fail ~30 stories on pre-existing findings, none of which this suite
       introduced, and two of which look like defects in the contract rather
       than in the components:

       - 5 hits on `button.ds-rating__button`, which the contract means to
         exempt: DENSE_AFFORDANCE_SELECTOR lists `.ds-rating__star`, but that
         class is on the inner element and the control is the button. The
         documented exemption never matches.
       - 6 hits on the visually-hidden native inputs behind Checkbox, Switch
         and RadioGroup, where the label carries the hit area.
       - 12 on `.ds-table__sort`, 2 each on `.ds-breadcrumb__link`,
         `.ds-rule-link` and `.ds-button--sm`, and one 1x1 button — genuine
         sizing questions, and answering them changes how components look.

       focusVisible reports 2, both the CommandPalette trigger.

       #116 should shrink that touch-target list, without turning the switch
       on. The dense floor measures `.ds-table__sort` and `.ds-button--sm` at
       24x24 instead of 44x44, and both clear it when measured in isolation
       against the shipped stylesheets — so the 12 + 2 above should be gone.
       The counts have not been re-run here, because re-running them means
       turning the flag on, which is #65's decision and not this one's. The
       `.ds-rating__button` 5 were already fixed when the exemption moved off
       the glyph onto the control. This flag staying `false` is also why #116
       moves no baseline through this file:
       the rendered-output changes in that PR (`.ds-table__sort`'s min-height
       and the coarse-pointer floor) move baselines through the screenshots,
       not through these assertions. */
    touchTargets: false,
    focusVisible: false,
  });

  await assertMarksCentred(page);
}

/* Every drawn mark sits exactly in the middle of the control that paints it.
 *
 * #166 replaced six controls' text glyphs — `×`, `★`/`☆`, `‹`/`›` — with drawn
 * SVG marks, because a character's position inside its line box is a property
 * of the font file and not something CSS can correct. The measurements that
 * motivated it, taken on the shipped components: `‹` sat 1.438px below its
 * button's centre, the search field's `×` 1.250px below, the toast's 0.750px.
 *
 * A mark cannot drift the same way — it has no baseline — but it can still be
 * put in a control that does not centre it. That is the failure this catches,
 * and it is a real one: `.ds-rating__star` and `.ds-date-picker__header button`
 * were NOT flex containers before #166, so an inline `<svg>` in either would
 * have sat on the text baseline and reintroduced the whole problem in a new
 * spelling. Both gained `display: inline-flex` in that change; this is what
 * stops them quietly losing it.
 *
 * LAYOUT, not pixels, and that distinction is the whole reason this assertion
 * can be exact. Painted ink snaps to the device pixel grid, so a control that
 * happens to land on a fractional page position paints its mark up to a pixel
 * from where the float geometry puts it — measured at 0.391px on
 * `.ds-rating__star` and 0.219px on `.ds-pagination__nav`, in both cases
 * exactly that control's own distance to the grid. The control snaps and the
 * mark snaps with it, so what a reader sees stays centred; it is only the
 * comparison against unsnapped geometry that shows a residual. Comparing boxes
 * to boxes takes the raster out of it entirely and lets this demand zero.
 *
 * The centre compared against is the parent's CONTENT box, not its border box.
 * They coincide today because every control here is symmetrically padded, but
 * a mark centres in the content box and asserting against the border box would
 * silently start measuring the wrong thing the day one of them is not.
 *
 * Exported, and that is for a reason worth knowing before you change it: this
 * runs from `afterCapture`, which fires only AFTER the screenshot assertion
 * passes — and outside the pinned container every baseline mismatches, so on a
 * developer machine the screenshot always throws first and this never runs at
 * all. Exporting it is what makes it reachable from a throwaway spec that
 * navigates to a story and calls it directly, which is the only way to see it
 * work without pushing. Verified that way against chip, rating (both stories)
 * and pagination; searchfield, toast and datepicker render no mark in their
 * default stories, which is a coverage gap in those stories rather than here.
 */
export async function assertMarksCentred(page: Page): Promise<void> {
  const offsets = await page.$$eval('.ds-mark', (marks) =>
    marks.map((mark) => {
      const control = mark.parentElement as HTMLElement;
      const box = mark.getBoundingClientRect();
      const outer = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      const px = (value: string) => Number.parseFloat(value) || 0;

      const left = outer.left + px(style.borderLeftWidth) + px(style.paddingLeft);
      const right = outer.right - px(style.borderRightWidth) - px(style.paddingRight);
      const top = outer.top + px(style.borderTopWidth) + px(style.paddingTop);
      const bottom = outer.bottom - px(style.borderBottomWidth) - px(style.paddingBottom);

      return {
        control: `${control.tagName.toLowerCase()}.${control.className || '(unclassed)'}`,
        dx: (box.left + box.right) / 2 - (left + right) / 2,
        dy: (box.top + box.bottom) / 2 - (top + bottom) / 2,
      };
    }),
  );

  for (const { control, dx, dy } of offsets) {
    /* Floats, so not `toBe(0)` — but three orders of magnitude tighter than
       any of the character offsets above, and tight enough that a control
       which stopped centring its mark could not slip through. */
    expect(
      Math.abs(dx),
      `${control} paints its mark ${dx.toFixed(3)}px off centre in x`,
    ).toBeLessThan(0.001);
    expect(
      Math.abs(dy),
      `${control} paints its mark ${dy.toFixed(3)}px off centre in y`,
    ).toBeLessThan(0.001);
  }
}
