// Two sweeps that give a repo full visual coverage without anyone writing down
// what to cover: point one at a built Storybook and one at a built site, and
// the subject list comes from the build's own index every run.
//
//   // tests/visual/storybook.spec.ts
//   import { expect, test } from '@playwright/test'
//   import { sweepStorybook, storybookStories } from '@elirobinson/ai-patterns/testing/visual-sweep'
//
//   sweepStorybook({
//     test,
//     expect,
//     baseUrl: 'http://127.0.0.1:6006',
//     stories: storybookStories({ storybookDir: 'storybook-static' }),
//   })
//
// That is the point of shipping this rather than documenting it: a list of
// "components you should snapshot" in a consumer's repo goes stale the moment
// either side adds one, and nothing reports it — the suite simply covers less
// than it claims. An enumerator cannot go stale.
//
// `test` and `expect` are injected rather than imported so @playwright/test
// stays an optional peer dependency and this module remains importable (and
// `require()`-able, hence no top-level await) without it.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { applyFixedClock } from './visual-config.mjs';

/* The design system opts into dark via `[data-theme="dark"]` on the root
   element, with `.dark` accepted as an alias. It does not key off
   `prefers-color-scheme`, so Playwright's `colorScheme` option has no effect
   and would produce two identical light baselines labelled differently — a
   dark-mode suite that silently tests nothing. */
export const THEMES = Object.freeze(['light', 'dark']);

export const DEFAULT_THEME_STORAGE_KEY = 'ds-theme';

/* Masked by default on full-page captures. The skeleton shimmer is an eased
   infinite animation, and settling a page disables and restores animations once
   per capture while the assertion does so again — so the write path and the
   compare path run a different number of cycles and come to rest a hair apart.
   Masked rather than tolerated: a pixel budget wide enough to swallow it is
   also wide enough to hide a real colour regression. */
export const DEFAULT_MASK = Object.freeze(['.ds-skeleton']);

/**
 * Every story in a built Storybook, sorted so the run order is stable.
 *
 * Read from the build's own index rather than from a list: adding a component
 * with a story is then all it takes to get visual coverage. The index also
 * carries `docs` entries — autodocs pages, not stories — which render a whole
 * page of generated prose and are not what a visual suite is measuring.
 *
 * `storybookDir` is resolved against the working directory, which for a pnpm
 * script is the package root.
 */
export function storybookStories({ storybookDir, hint } = {}) {
  if (!storybookDir) {
    throw new TypeError('storybookStories needs a `storybookDir` — the built Storybook output.');
  }

  const indexPath = resolve(process.cwd(), storybookDir, 'index.json');
  const raw = readManifest(indexPath, {
    subject: 'No Storybook index',
    reads: 'reads it to enumerate stories — build Storybook first',
    hint,
  });

  const entries = JSON.parse(raw).entries ?? {};

  return Object.values(entries)
    .filter((entry) => entry.type === 'story')
    .map(({ id, title, name }) => ({ id, title, name }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The isolated render of one story, without Storybook's own UI around it. */
export function storyUrl(baseUrl, id) {
  return `${baseUrl}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;
}

/**
 * Every prerendered page of a built Next app, sorted so the run order is stable.
 *
 * Read from Next's own prerender manifest rather than a list. Dynamic segments
 * arrive already expanded by generateStaticParams, so a route that exists is a
 * route that gets a baseline — provided the app is fully static; anything
 * server-rendered is not in the manifest and this cannot see it.
 *
 * `exclude` drops routes on top of the built-in filtering, for pages a suite
 * genuinely cannot hold still.
 */
export function nextStaticRoutes({ appDir, exclude, hint } = {}) {
  if (!appDir) {
    throw new TypeError('nextStaticRoutes needs an `appDir` — the Next app that was built.');
  }

  const manifestPath = resolve(process.cwd(), appDir, '.next/prerender-manifest.json');
  const raw = readManifest(manifestPath, {
    subject: 'No prerender manifest',
    reads: 'reads it to enumerate pages — build the app first',
    hint,
  });

  return Object.keys(JSON.parse(raw).routes ?? {})
    .filter(isVisualRoute)
    .filter((route) => !exclude?.(route))
    .sort((a, b) => a.localeCompare(b));
}

/* The manifest lists everything static, which is more than the pages a person
   can look at. */
function isVisualRoute(route) {
  /* Next's internals: /_not-found and /_global-error. A 404 page is worth
     covering eventually, but through a route a visitor can actually reach. */
  if (route.startsWith('/_')) {
    return false;
  }

  /* Route handlers, not pages — llms.txt, a registry's /r/*.json entries, and
     anything else that serves text and has nothing to render. */
  if (route.endsWith('.txt') || route.endsWith('.json')) {
    return false;
  }

  return true;
}

function readManifest(path, { subject, reads, hint }) {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(
      `${subject} at ${path}.\nThe visual suite ${reads}${hint ? ` (${hint})` : ''}.`,
      { cause: error },
    );
  }
}

/** A filename-safe name for a route: `/` is `index`, `/a/b` is `a-b`. */
export function routeSlug(route) {
  return route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '-');
}

/**
 * Selects a theme for the page. Must be called before `page.goto` — this
 * registers an init script.
 *
 * Seeding storage drives whatever pre-paint bootstrap the site already ships,
 * so the snapshot reflects what a visitor who picked this theme actually gets;
 * the attribute covers a surface with no such bootstrap, such as a Storybook
 * iframe. Setting both leaves the two in agreement either way.
 */
export async function applyTheme(page, theme, { storageKey = DEFAULT_THEME_STORAGE_KEY } = {}) {
  await page.addInitScript(
    ({ value, key }) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* Blocked storage just means the attribute below does the work. */
      }

      const apply = () => document.documentElement?.setAttribute('data-theme', value);

      /* Order matters, and getting it wrong fails silently in the worst
         possible way. Init scripts run at document_start, where
         documentElement may not exist yet: calling apply() first throws, so the
         listener is never registered and the attribute is never set at all —
         every "dark" snapshot is then just the light one, a dark-mode suite
         testing nothing.

         Register the fallback first, then attempt the immediate set so the
         first paint is already themed when the element is available. */
      document.addEventListener('DOMContentLoaded', apply);
      apply();
    },
    { value: theme, key: storageKey },
  );
}

/**
 * Holds until the page's pixels stop moving. `fullPage` must match the
 * assertion that follows — stabilising the viewport while asserting on the
 * whole page watches a different image than the one being written, so
 * everything below the fold could still be moving and this would call it
 * settled.
 */
export async function waitForStablePixels(page, { expect, fullPage = false, timeout = 60_000 }) {
  if (typeof expect?.poll !== 'function') {
    throw new TypeError(
      "waitForStablePixels needs Playwright's `expect` — pass it in: waitForStablePixels(page, { expect }).",
    );
  }

  /* Images are not covered by document.fonts.ready, and a capture taken while
     one is still decoding bakes a half-drawn page into the baseline. Cheap and
     targeted, where the settle loop below is the general safety net. */
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));

  /* Fonts may resolve from a system stack rather than the network, but a
     capture taken before they are applied still measures different text
     metrics. */
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  /* A text caret blinks roughly twice a second, and it is not a CSS animation,
     so `animations: 'disabled'` does not touch it. Any page that focuses an
     input renders a bar that is present in some frames and absent in others. */
  await page.addStyleTag({
    content: '*, *::before, *::after { caret-color: transparent !important; }',
  });

  /* Holds until two consecutive captures agree.

     Measured worth, not a guess. Removing this and relying on
     toHaveScreenshot's own stability check took a serial container run from 1
     failure in 496 to roughly 8 in 223 — its longer, backing-off intervals
     catch late repaints that Playwright's tighter loop settles too early on.

     The timeout is generous because the capture itself is the slow part. Under
     emulation a full-page shot of a long page takes seconds, so a 10s budget is
     spent on three or four captures and expires before two can agree. */
  const capture = () => page.screenshot({ animations: 'disabled', fullPage });

  let previous = await capture();

  await expect
    .poll(
      async () => {
        const next = await capture();
        const unchanged = next.equals(previous);
        previous = next;
        return unchanged;
      },
      { intervals: [100, 200, 400, 800], timeout },
    )
    .toBe(true);
}

/**
 * Registers one test per story per theme, each capturing the story's viewport.
 *
 * The viewport, not the story root: overlays portal into document.body, so a
 * clipped capture keeps the trigger and silently drops the panel — the
 * positioning and elevation that make an overlay worth testing at all. And
 * deciding per story whether anything rendered outside the root is not stable,
 * so the same story chooses different capture targets on different runs, which
 * cannot produce a baseline. A story taller than the viewport is cropped by
 * this.
 *
 * `afterCapture` runs after the screenshot, deliberately: a contract check that
 * focuses controls to see whether focusing changes anything would otherwise
 * bake a focus ring into the baseline.
 */
export function sweepStorybook({
  test,
  expect,
  baseUrl,
  stories,
  themes = THEMES,
  themeStorageKey,
  rootSelector = '#storybook-root',
  title = (story, theme) => `${story.id} · ${theme}`,
  name = (story, theme) => `${story.id}-${theme}.png`,
  afterCapture,
}) {
  assertSweepable({ test, expect, baseUrl, subjects: stories, subjectName: 'stories' });

  for (const story of stories) {
    for (const theme of themes) {
      test(title(story, theme), async ({ page }) => {
        await applyFixedClock(page);
        await applyTheme(page, theme, { storageKey: themeStorageKey });
        await page.goto(storyUrl(baseUrl, story.id));

        /* Resolves once the story has actually rendered. */
        await page.waitForFunction((selector) => {
          const root = document.querySelector(selector);
          return Boolean(root && root.children.length > 0);
        }, rootSelector);

        await waitForStablePixels(page, { expect });

        await expect(page).toHaveScreenshot(name(story, theme));

        await afterCapture?.(page, { story, theme });
      });
    }
  }
}

/**
 * The document-space box of the one element `selector` matches, rounded
 * outward to whole pixels.
 *
 * Document space, not viewport space, because the box is handed to a
 * `fullPage` capture: the full-page image is the document, so a viewport-
 * relative rect would be off by the scroll offset. The scroll is reset first
 * for the same reason a sticky header exists — a `position: sticky` element's
 * rect follows the scroll, and measuring it anywhere but the top would name a
 * box the full-page image does not paint it into.
 *
 * Throws unless exactly one element matches, and throws on a zero-sized one.
 * A selector that has stopped matching — a renamed class, a region hidden at
 * this viewport — would otherwise silently degrade to "compare the whole page"
 * or "compare nothing", and both report as a pass.
 */
export async function regionBox(page, selector) {
  const measured = await page.evaluate((sel) => {
    /* `instant`: a site with `scroll-behavior: smooth` would still be gliding
       when the rect below is read. */
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    const found = document.querySelectorAll(sel);
    if (found.length !== 1) {
      return { count: found.length };
    }

    const rect = found[0].getBoundingClientRect();
    return {
      count: 1,
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      width: rect.width,
      height: rect.height,
    };
  }, selector);

  if (measured.count !== 1) {
    throw new Error(
      `Capture region '${selector}' matched ${measured.count} elements; it has to match exactly one. ` +
        'A region that matches nothing would capture the whole page, and one that matches several ' +
        'would capture whichever the DOM happens to list first — both pass silently.',
    );
  }

  if (measured.width === 0 || measured.height === 0) {
    throw new Error(
      `Capture region '${selector}' has no area (${measured.width}×${measured.height}). ` +
        'A zero-sized region captures nothing and compares clean on every run.',
    );
  }

  /* Outward, so the box can never crop a subpixel edge of the region: a `%` or
     `vw` length lands on a fraction routinely (4vw at 1280px is 51.2px), and
     rounding to nearest would drop the last row of pixels on half of them. */
  const left = Math.floor(measured.x);
  const top = Math.floor(measured.y);

  return {
    x: left,
    y: top,
    width: Math.ceil(measured.x + measured.width) - left,
    height: Math.ceil(measured.y + measured.height) - top,
  };
}

/**
 * Registers one test per route per theme.
 *
 * Full-page rather than viewport-sized: this is the sweep that covers what a
 * component sweep structurally cannot — components composed next to each other,
 * the site chrome around them, and token ramps at page scale — and most of that
 * is below the fold. Cropping to the fold would leave exactly the details it
 * exists to catch outside the frame.
 *
 * `region` narrows the frame the other way, and is the option a site with
 * persistent chrome wants. A sidebar derived from a registry renders on every
 * page, so one added entry moves pixels in every full-page shot at once and the
 * suite reports one fact N times. Naming the content element instead puts the
 * chrome outside the frame, which makes that fan-out structurally impossible
 * rather than merely tolerated — and leaves the chrome to `sweepChrome`, where
 * it is compared once. It does NOT weaken what the page shots catch: the
 * content region is where composed components and token ramps are.
 *
 * The capture stays `fullPage` with a clip rather than becoming an element
 * screenshot. Playwright scrolls an element into view before shooting it, and a
 * sticky header then paints across the top of the very region being captured —
 * measured on this repo's docs site, which lost its `<h1>` behind the header on
 * every page. Clipping the full-page image has no scroll to be caught by.
 */
export function sweepPages({
  test,
  expect,
  baseUrl,
  routes,
  themes = THEMES,
  themeStorageKey,
  fullPage = true,
  region,
  mask = DEFAULT_MASK,
  title = (route, theme) => `${route} · ${theme}`,
  name = (route, theme) => `${routeSlug(route)}-${theme}.png`,
  afterCapture,
}) {
  assertSweepable({ test, expect, baseUrl, subjects: routes, subjectName: 'routes' });

  for (const route of routes) {
    for (const theme of themes) {
      test(title(route, theme), async ({ page }) => {
        await applyFixedClock(page);
        await applyTheme(page, theme, { storageKey: themeStorageKey });
        await page.goto(`${baseUrl}${route}`);

        /* A framework hydrates after the document loads and mounts controls
           with it, so the markup keeps moving for a moment past
           domcontentloaded. Waiting for the pixels beats waiting for any
           particular framework signal. */
        await page.waitForLoadState('load');

        /* Settled against the whole page even when the capture is a region of
           it. The region is a subset, so this is the conservative direction —
           and layout outside it can still push the region around, which a
           region-only settle would watch happen and call stable. */
        await waitForStablePixels(page, { expect, fullPage });

        await expect(page).toHaveScreenshot(name(route, theme), {
          fullPage,
          /* Measured after the settle: before it, the box is whatever the
             pre-hydration layout happened to be. */
          ...(region ? { clip: await regionBox(page, region) } : {}),
          mask: mask.map((selector) => page.locator(selector)),
        });

        await afterCapture?.(page, { route, theme });
      });
    }
  }
}

/**
 * Registers one test per chrome region per theme, all on a single route.
 *
 * The other half of `sweepPages`' `region`. Clipping page shots to the content
 * element takes the header, sidebar, nav and footer out of every frame, and
 * chrome that nothing shoots is chrome nothing checks. This shoots each piece
 * once instead of once per page — which is the coverage those pieces actually
 * warrant, rather than the number a full-page frame happened to produce.
 *
 * `route` is the page the chrome is rendered on. One is enough by definition:
 * a region that renders differently per page is page content, not chrome.
 *
 * The default subject is a path (`/chrome/<name>`), so a chrome shot is
 * route-shaped everywhere downstream — a scoper that widens "every docs route"
 * picks it up, and a baseline-path mapping written for routes needs no case for
 * it.
 *
 * A namespace with no punctuation to mark it apart, deliberately: Playwright
 * sanitises a snapshot name down to `[A-Za-z0-9-]`, rewriting `_` and `@` and
 * the rest to `-`. A subject spelled `/_chrome/header` therefore lands on disk
 * as `-chrome-header-…`, which no route-to-path mapping would predict — the
 * kind of drift that shows up as a baseline nothing claims. So the collision
 * with a real `/chrome/*` page is ruled out where the routes are known: pass
 * `subject` if the site has one.
 */
export function sweepChrome({
  test,
  expect,
  baseUrl,
  route = '/',
  regions,
  themes = THEMES,
  themeStorageKey,
  mask = DEFAULT_MASK,
  subject = (chrome) => `/chrome/${chrome.name}`,
  title = (chrome, theme) => `${subject(chrome)} · ${theme}`,
  name = (chrome, theme) => `${routeSlug(subject(chrome))}-${theme}.png`,
  afterCapture,
}) {
  assertSweepable({ test, expect, baseUrl, subjects: regions, subjectName: 'regions' });

  for (const chrome of regions) {
    if (!chrome?.name || !chrome?.selector) {
      throw new TypeError(
        `A chrome region needs both a \`name\` and a \`selector\`; got ${JSON.stringify(chrome)}. ` +
          "The name is the shot's identity and the selector is what it frames — neither has a " +
          'safe default.',
      );
    }
  }

  for (const chrome of regions) {
    for (const theme of themes) {
      test(title(chrome, theme), async ({ page }) => {
        await applyFixedClock(page);
        await applyTheme(page, theme, { storageKey: themeStorageKey });
        await page.goto(`${baseUrl}${route}`);
        await page.waitForLoadState('load');
        await waitForStablePixels(page, { expect, fullPage: true });

        await expect(page).toHaveScreenshot(name(chrome, theme), {
          fullPage: true,
          clip: await regionBox(page, chrome.selector),
          mask: mask.map((selector) => page.locator(selector)),
        });

        await afterCapture?.(page, { region: chrome, theme });
      });
    }
  }
}

/* A sweep that registers nothing looks exactly like a sweep that passed, which
   is the one way this can fail without anyone noticing. */
function assertSweepable({ test, expect, baseUrl, subjects, subjectName }) {
  if (typeof test !== 'function' || typeof expect !== 'function') {
    throw new TypeError(
      "A sweep needs Playwright's `test` and `expect` passed in — they are not imported here, " +
        'so @playwright/test can stay an optional peer dependency.',
    );
  }

  if (!baseUrl) {
    throw new TypeError('A sweep needs a `baseUrl` — where the built output is being served.');
  }

  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new TypeError(
      `A sweep needs a non-empty \`${subjectName}\` array. An empty one registers no tests, ` +
        'which reports as a pass.',
    );
  }
}
