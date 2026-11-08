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

   Why this exists, and how to add a case: docs/agents/visual-regression.md,
   "preflight-wide". apps/preflight-host is a consumer's build: Vite,
   Tailwind's plugin, and the CSS entry the installation page prescribes.

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

/**
 * Asserts each `[data-probe]` element is painted the token it maps to.
 * Comparing against the page's own resolution of the token keeps the check
 * palette- and theme-agnostic.
 */
async function expectProbeColours(page: Page, table: Record<string, string>) {
  const entries = Object.entries(table);
  const tokens = await Promise.all(entries.map(([, token]) => tokenColour(page, token)));

  /* Distinct, or a check below would compare a colour with itself. */
  expect(new Set(tokens).size, 'distinct token colours').toBe(new Set(Object.values(table)).size);

  for (const [index, [probe, token]] of entries.entries()) {
    expect((await probeStyle(page, probe)).color, `${probe} is ${token}`).toBe(tokens[index]);
  }
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
     the viewport's free space. */
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
    await expectHeight(page, '.ds-tabs__trigger--active', 44);
  },

  /* #112. Unlayered, tokens.css's `a` rule beat every `text-*` utility. In
     `@layer base` a utility wins, and an anchor nobody styled keeps --link
     and its underline even though Preflight resets both. */
  'link-colour': async (page) => {
    await expectProbeColours(page, {
      plain: '--link',
      'accent-foreground': '--accent-fg',
      'muted-foreground': '--fg-3',
      'accent-ink': '--accent-ink',
    });
    expect((await probeStyle(page, 'plain')).decoration).toBe('underline');
    expect((await probeStyle(page, 'accent-ink')).decoration).toBe('none');
  },

  /* #251. Unlayered, a `.t-*` class's colour beat every `text-*` utility. */
  'type-colour': (page) =>
    expectProbeColours(page, {
      caption: '--fg-3',
      'caption-destructive': '--status-danger-fg',
      'body-accent': '--accent-ink',
    }),

  /* #34. The host's CSS sets --ds-font-sans-override on :root. If tokens.css
     stops reading it, every family below falls back to Geist. */
  'font-override': async (page) => {
    for (const probe of ['body', 'type-class', 'utility', 'button', 'input']) {
      const { fontFamily } = await probeStyle(page, probe);
      expect(fontFamily, `${probe} font-family`).toMatch(/^"?JetBrains Mono"?(,|$)/);
    }
  },
};

/**
 * Records every failed request to the host. A missing font or chunk would
 * otherwise render a fallback that CI then mints as the baseline.
 * `sweepPages` does the same with a helper it does not export; this spec
 * cannot use `sweepPages` because it has no hook BEFORE the capture, which
 * is where the layout check must run.
 */
function watchForFailedRequests(page: Page) {
  const failed: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(PREFLIGHT_HOST_URL) && response.status() >= 400) {
      failed.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(PREFLIGHT_HOST_URL)) {
      failed.push(`failed ${request.url()}`);
    }
  });
  return () => expect(failed, 'requests to the host that failed').toEqual([]);
}

/* One title shape for every shot in the suite: `<subject> · <theme>`, with a
   route-shaped subject, so scripts/visual-shots.mjs maps it to a baseline the
   same way it maps a docs route. */
for (const entry of PREFLIGHT_CASES) {
  const subject = `${PREFLIGHT_PREFIX}/${entry.id}`;

  for (const theme of THEMES) {
    test(`${subject} · ${theme}`, async ({ page }) => {
      for (const issue of entry.issues) {
        test.info().annotations.push({ type: 'issue', description: `#${issue}` });
      }
      const expectNoFailedRequests = watchForFailedRequests(page);
      await applyTheme(page, theme);
      await page.goto(`${PREFLIGHT_HOST_URL}/${caseQuery(entry.id)}`);
      await page.waitForLoadState('load');

      /* A case that did not render must not pass as an empty, clean page. */
      await expect(page.locator(`main[data-case="${entry.id}"]`)).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);

      expectNoFailedRequests();
      await CHECKS[entry.id](page);

      await waitForStablePixels(page, { expect });
      await expect(page).toHaveScreenshot(`${routeSlug(subject)}-${theme}.png`);
    });
  }
}
