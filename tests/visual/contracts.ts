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
 * #166 replaced six controls' text glyphs with drawn SVG marks, and #172 built
 * them. `scripts/marks.test.mjs` proves each mark is centred in its own
 * viewBox — arithmetic, exact, and entirely about the mark. This is the other
 * half: whether the CONTROL puts it in the middle.
 *
 * Those are different failures with different causes. A mark cannot drift the
 * way a character did, because it has no baseline; but it can be dropped into a
 * control that does not centre it, and then the glyph is off-centre again for a
 * new reason. That is not hypothetical — `.ds-rating__star` and
 * `.ds-date-picker__header button` were NOT flex containers before #172, so an
 * inline `<svg>` in either would have sat on the text baseline and reproduced
 * the whole problem. Both gained `display: inline-flex` there, with a comment
 * saying why. Nothing currently fails if one loses it: delete those three lines
 * today and the arithmetic test stays green.
 *
 * LAYOUT, not pixels, and that is what lets this demand zero rather than a
 * tolerance. Painted ink snaps to the device grid, so a control that lands on a
 * fractional page position paints its mark up to a pixel from where the float
 * geometry puts it — measured while writing this at 0.391px on
 * `.ds-rating__star` and 0.219px on `.ds-pagination__nav`, in both cases
 * exactly that control's own distance to the grid. The control snaps and the
 * mark snaps with it, so what a reader sees stays centred; only a comparison
 * against unsnapped geometry shows a residual. Comparing boxes to boxes takes
 * the raster out of it.
 *
 * The centre compared against is the parent's CONTENT box. It coincides with
 * the border box for every control here today, because all of them are
 * symmetrically padded — but a mark centres in the content box, and asserting
 * against the border box would silently start measuring the wrong thing the
 * day one of them is not.
 *
 * PER AXIS, because not every mark is centred on both. This asserted both
 * unconditionally until `.ds-accordion__trigger` painted one: that trigger is
 * `justify-content: space-between`, which puts the mark hard against the right
 * edge on purpose, and the check reported it 617px off centre in x. The claim
 * was too strong, not the layout. What a flex box actually promises is the axis
 * it says it centres — `justify-content` for the main axis, `align-items` for
 * the cross one — so each is now asserted only where the control claims it.
 *
 * That would be a hole if a control could opt out of both, so it cannot: a mark
 * whose parent centres it on neither axis fails outright. That is the shape of
 * the regression this exists to catch — a mark dropped into a box that does not
 * centre it — and it is what a `.ds-rating__star` that lost `display:
 * inline-flex` looks like.
 *
 * Exported, and worth knowing why before moving it: this runs from
 * `afterCapture`, which fires only AFTER the screenshot assertion passes — and
 * outside the pinned container every baseline mismatches, so on a developer
 * machine the screenshot always throws first and this never executes. Exporting
 * it makes it reachable from a throwaway spec that navigates to a story and
 * calls it directly, which is the only way to watch it work without pushing.
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

      /* Which axes this control actually claims to centre on. A flex box
         centres its main axis with `justify-content` and its cross axis with
         `align-items`, and which of those is x depends on the direction. */
      const column = style.flexDirection.startsWith('column');
      const centresX = (column ? style.alignItems : style.justifyContent) === 'center';
      const centresY = (column ? style.justifyContent : style.alignItems) === 'center';

      return {
        control: `${control.tagName.toLowerCase()}.${control.className || '(unclassed)'}`,
        centresX,
        centresY,
        dx: (box.left + box.right) / 2 - (left + right) / 2,
        dy: (box.top + box.bottom) / 2 - (top + bottom) / 2,
      };
    }),
  );

  for (const { control, centresX, centresY, dx, dy } of offsets) {
    /* A mark in a box that centres it on NEITHER axis is the failure this
       exists for — it is what `.ds-rating__star` looked like before it was a
       flex container, with the mark seated on the text baseline. Asserted
       first, because the two axis checks below are vacuous for such a box:
       both would be skipped and the mark would pass unexamined. */
    expect(
      centresX || centresY,
      `${control} centres its mark on neither axis — is it still a flex container?`,
    ).toBe(true);

    /* Floats, so not `toBe(0)` — but three orders of magnitude below the
       offsets the characters carried (the date picker's `‹` sat 1.438px low),
       and tight enough that a control which stopped centring its mark could
       not slip through. */
    if (centresX) {
      expect(
        Math.abs(dx),
        `${control} paints its mark ${dx.toFixed(3)}px off centre in x`,
      ).toBeLessThan(0.001);
    }
    if (centresY) {
      expect(
        Math.abs(dy),
        `${control} paints its mark ${dy.toFixed(3)}px off centre in y`,
      ).toBeLessThan(0.001);
    }
  }
}
