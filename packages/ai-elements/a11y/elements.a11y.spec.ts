import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  checkContrast,
  checkFocusVisible,
  checkHitAreaOverlap,
  checkTouchTargets,
  PRIMARY_CONTROL_SELECTOR,
} from '@elirobinson/ai-patterns/testing/playwright';
import { expect, test } from '@playwright/test';

/* The audit itself: every vendored component, every dial, all four checks.
 *
 * Deliberately unscoped. tests/visual/contracts.ts scopes its selectors to
 * `#storybook-root` because a Storybook page is mostly framework chrome, and a
 * docs page is mostly editorial prose — neither is the component under test.
 * This harness renders one fixture and nothing else, so there is nothing to
 * scope away; and scoping to the fixture root would actively lose coverage,
 * because Radix portals a dropdown's menu items and a dialog's controls to
 * `document.body`, outside any wrapper the harness could put around the
 * fixture. Those are exactly the controls this audit is about.
 */

const RESULTS = fileURLToPath(new URL('./results/violations.jsonl', import.meta.url));

type ManifestEntry = { name: string; tier: string };
const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../dist/manifest.json', import.meta.url)), 'utf8'),
) as { entries: ManifestEntry[] };

/* Read off the manifest, not off a list kept here. The manifest is regenerated
 * from the emitted declaration files on every build, so a component upstream
 * adds arrives in this sweep by itself — and arrives failing, because the
 * harness reports "no fixture named …" as a fixture error and the first
 * assertion below is on that. A roster nobody maintains cannot fall behind. */
const COMPONENTS = manifest.entries
  .filter((entry) => entry.tier === 'components')
  .map((entry) => entry.name)
  .sort();

/* `ember` is the default palette and sets no attribute — the harness leaves
 * `data-palette` off for it, which is what a consumer who never touches the
 * dial gets, and therefore the case worth measuring rather than skipping. */
const PALETTES = ['ember', 'slate', 'miltinson'] as const;
const THEMES = ['light', 'dark'] as const;
/* `data-platform="mobile"` is the dial, not a viewport. tokens.css floors every
 * non-dense control to var(--target) under it, so this is the run that says
 * whether a vendored <button> is reached by our own mobile floor — which was
 * written for our components and has never been pointed at anyone else's. */
const PLATFORMS = ['desktop', 'mobile'] as const;

/* The one documented exception, narrowed at the call site rather than hidden in
 * an attribute — which is what `checkTouchTargets`' own docblock asks for, so
 * that an exception is visible in the test and reviewable.
 *
 * `.react-flow__attribution a` is React Flow's own licence attribution link,
 * 51x13, painted into the corner of every canvas by `<ReactFlow>` itself. It is
 * not Elements' markup and not ours: it appears in no vendored class string, so
 * the transform layer cannot reach it, and React Flow's licence requires it to
 * stay unless a consumer holds a Pro subscription (`proOptions.hideAttribution`
 * is the paid opt-out, not an accessibility fix). Resizing a third party's
 * licence notice to 44x44 in the corner of the canvas is not a trade this audit
 * gets to make on a consumer's behalf.
 *
 * Six components carry it — canvas, connection, controls, edge, node and
 * toolbar — and it is the same single element in all six. */
const REACT_FLOW_ATTRIBUTION = '.react-flow__attribution *';

const controlsExceptAttribution = PRIMARY_CONTROL_SELECTOR.split(', ')
  .map((selector) => `${selector}:not(${REACT_FLOW_ATTRIBUTION})`)
  .join(', ');

/* Colour, which is not this audit's to fix. Every entry is a *component*, not a
 * selector, and the list is asserted both ways: a component with a contrast
 * finding that is not named here fails, and a component named here that has
 * stopped failing also fails, with a message saying to delete the entry. That
 * second direction is what keeps this from becoming a suppression list — the
 * day the token bridge lands, this test goes red and tells you why.
 *
 * Both causes are recorded in docs/agents/ai-elements-accessibility.md. */
const CONTRAST_OWNED_ELSEWHERE = new Map([
  /* `agent`, `code-block` and `tool` were here for the shiki cause: their `dark:`
     overrides never fired, so github-light token colours painted on the dark
     surface (1.43:1, 1.58:1, 3.33:1). The token bridge now re-points Tailwind's
     `dark` variant at [data-theme="dark"], those overrides fire, and all three
     stopped failing — so this list told us to delete them, which is the second
     direction working exactly as intended. */
  [
    'transcription',
    '`text-muted-foreground/60` measures 2.31-3.28:1 — an opacity modifier on a token, which is a colour decision',
  ],
]);

function record(row: unknown) {
  mkdirSync(fileURLToPath(new URL('./results', import.meta.url)), { recursive: true });
  appendFileSync(RESULTS, `${JSON.stringify(row)}\n`);
}

for (const platform of PLATFORMS) {
  for (const theme of THEMES) {
    for (const palette of PALETTES) {
      const dials = { platform, theme, palette };
      const suffix = `${platform}/${theme}/${palette}`;

      test.describe(suffix, () => {
        for (const component of COMPONENTS) {
          test(component, async ({ page }) => {
            const query = new URLSearchParams({ fixture: component, theme, palette });
            if (platform === 'mobile') query.set('platform', 'mobile');

            await page.goto(`/index.html?${query}`);
            await page.waitForSelector('body[data-fixture-ready="true"]', { timeout: 15_000 });

            /* Before anything else. A fixture that threw renders no controls,
             * and four checks over no controls report a clean sweep — the
             * false green this whole file exists to avoid. */
            const error = await page.evaluate(() => document.body.dataset.fixtureError);
            expect(error, `fixture "${component}" failed to render`).toBeUndefined();

            const touchTargets = await checkTouchTargets(page, {
              selector: controlsExceptAttribution,
            });
            const hitAreaOverlap = await checkHitAreaOverlap(page, {
              selector: controlsExceptAttribution,
            });
            const focusVisible = await checkFocusVisible(page);
            const contrast = await checkContrast(page);

            record({
              ...dials,
              component,
              touchTargets,
              hitAreaOverlap,
              focusVisible,
              contrast,
            });

            expect(
              { touchTargets, hitAreaOverlap, focusVisible },
              `${component} @ ${suffix}`,
            ).toEqual({ touchTargets: [], hitAreaOverlap: [], focusVisible: [] });

            const owned = CONTRAST_OWNED_ELSEWHERE.get(component);

            if (!owned) {
              expect(contrast, `${component} @ ${suffix}: unexpected contrast finding`).toEqual([]);
              return;
            }

            /* Dark only, for both causes. In light the same components pass, so
               asserting "always fails" here would be wrong — the claim is that
               where it fails, it fails for the recorded reason. */
            if (theme === 'light') return;

            expect(
              contrast.length,
              `${component} @ ${suffix} no longer has a contrast finding.\n\n` +
                `  recorded cause: ${owned}\n\n` +
                "If the token bridge now re-points Tailwind's `dark` variant at " +
                '[data-theme="dark"], this is fixed — delete this component from ' +
                'CONTRAST_OWNED_ELSEWHERE and from the handover section of ' +
                'docs/agents/ai-elements-accessibility.md.',
            ).toBeGreaterThan(0);
          });
        }
      });
    }
  }
}
