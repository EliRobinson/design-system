import type { Page } from '@playwright/test';

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
}
