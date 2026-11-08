import type { Page } from '@playwright/test';

import {
  THEMES,
  applyTheme,
  routeSlug,
  waitForStablePixels,
} from '@elirobinson/ai-patterns/testing/visual-sweep';

import {
  PREFLIGHT_CASES,
  type PreflightCaseId,
  caseQuery,
} from '../../../apps/preflight-host/src/cases';
import { expect, test } from '../fixtures';
import { PREFLIGHT_HOST_URL, PREFLIGHT_PREFIX } from './host';

/* @elirobinson/react inside a Tailwind v4 consumer, with full Preflight.

   Storybook loads no Preflight and the docs site scopes it to its demo stage
   (#228), so neither can show a bug that only exists where our CSS meets the
   reset. Seven consumer issues were that shape and nothing here caught them.
   apps/preflight-host is a consumer's build: Vite, Tailwind's plugin, and the
   CSS entry the installation page prescribes.

   Each test is one case in one theme, and does two things in order:

   1. A layout check: measured geometry or computed colour, written so that
      reverting the case's fix fails it. It runs BEFORE the screenshot, because
      CI mints a baseline for any shot that has none, and a check that ran
      after would let a first shot record a broken state as truth.
   2. A screenshot of the viewport, compared like every other shot.

   #250 (`--container-*` changes `max-w-*`) has no case: it is still open, so
   there is no fix to revert. Add one with its fix. */

type LayoutCheck = (page: Page) => Promise<void>;

/** The page's own resolution of a colour token, as `getComputedStyle` writes it. */
function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

function probeStyle(page: Page, probe: string) {
  return page.locator(`[data-probe="${probe}"]`).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      decoration: style.textDecorationLine,
      fontFamily: style.fontFamily,
    };
  });
}

/** Asserts the open modal sits in the middle of the viewport, to the pixel. */
async function expectCentredModal(page: Page) {
  const dialog = page.locator('dialog[open]');
  await expect(dialog).toHaveCount(1);

  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) {
    throw new Error('The modal has no box, or the page has no viewport.');
  }

  /* Under the bug the box is pinned to the top-left, so each offset is half
     the free space: 400px across at the 1280px viewport. */
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1);
}

/** Asserts `selector` matches one element of exactly `height` px. */
async function expectHeight(page: Page, selector: string, height: number) {
  const target = page.locator(selector);
  await expect(target).toHaveCount(1);
  const box = await target.boundingBox();
  expect(box?.height, `${selector} height`).toBeCloseTo(height, 1);
}

const CHECKS: Record<PreflightCaseId, LayoutCheck> = {
  /* #78 and #103. Without `.ds-dialog { margin: auto }`, Preflight's
     `* { margin: 0 }` beats the UA's centring. */
  dialog: expectCentredModal,
  'command-palette': expectCentredModal,

  /* #126. With no line-height of their own, these controls inherit the
     body's 1.65 under Preflight and grow past their min-height. */
  'form-controls': async (page) => {
    await expectHeight(page, 'input.ds-input', 44);
    await expectHeight(page, 'select.ds-input', 44);
    await expectHeight(page, 'textarea.ds-input', 64);
    await expectHeight(page, '.ds-tabs__trigger[data-state="active"]', 44);
  },

  /* #112. Unlayered, tokens.css's `a` rule beat every `text-*` utility. In
     `@layer base` a utility wins, and an anchor nobody styled keeps --link
     and its underline even though Preflight resets both. */
  'link-colour': async (page) => {
    const link = await tokenColour(page, '--link');
    const accentFg = await tokenColour(page, '--accent-fg');
    const muted = await tokenColour(page, '--fg-3');
    const accentInk = await tokenColour(page, '--accent-ink');

    /* Distinct, or the checks below compare a colour with itself. */
    expect(new Set([link, accentFg, muted, accentInk]).size).toBe(4);

    const plain = await probeStyle(page, 'plain');
    expect(plain.color).toBe(link);
    expect(plain.decoration).toBe('underline');

    expect((await probeStyle(page, 'accent-foreground')).color).toBe(accentFg);
    expect((await probeStyle(page, 'muted-foreground')).color).toBe(muted);

    const ink = await probeStyle(page, 'accent-ink');
    expect(ink.color).toBe(accentInk);
    expect(ink.decoration).toBe('none');
  },

  /* #251. Unlayered, a `.t-*` class's colour beat every `text-*` utility. */
  'type-colour': async (page) => {
    const fg3 = await tokenColour(page, '--fg-3');
    const danger = await tokenColour(page, '--status-danger-fg');
    const accentInk = await tokenColour(page, '--accent-ink');
    expect(new Set([fg3, danger, accentInk]).size).toBe(3);

    expect((await probeStyle(page, 'caption')).color).toBe(fg3);
    expect((await probeStyle(page, 'caption-destructive')).color).toBe(danger);
    expect((await probeStyle(page, 'body-accent')).color).toBe(accentInk);
  },

  /* #34. The host's CSS sets --ds-font-sans-override on :root. If tokens.css
     stops reading it, every family below falls back to Geist. */
  'font-override': async (page) => {
    for (const probe of ['body', 'type-class', 'utility', 'button', 'input']) {
      const { fontFamily } = await probeStyle(page, probe);
      expect(fontFamily, `${probe} font-family`).toMatch(/^"?JetBrains Mono"?(,|$)/);
    }
  },
};

/* One title shape for every shot in the suite: `<subject> · <theme>`, with a
   route-shaped subject, so scripts/visual-shots.mjs maps it to a baseline the
   same way it maps a docs route. */
for (const entry of PREFLIGHT_CASES) {
  const subject = `${PREFLIGHT_PREFIX}/${entry.id}`;

  for (const theme of THEMES) {
    test(`${subject} · ${theme}`, async ({ page }) => {
      await applyTheme(page, theme);
      await page.goto(`${PREFLIGHT_HOST_URL}/${caseQuery(entry.id)}`);
      await page.waitForLoadState('load');

      /* A case that did not render must not pass as an empty, clean page. */
      await expect(page.locator(`main[data-case="${entry.id}"]`)).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);

      await CHECKS[entry.id](page);

      await waitForStablePixels(page, { expect });
      await expect(page).toHaveScreenshot(`${routeSlug(subject)}-${theme}.png`);
    });
  }
}
