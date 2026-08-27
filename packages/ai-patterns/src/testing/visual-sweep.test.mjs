// The sweeps exist so nobody writes down what to cover, which means the
// enumerators are the coverage: a filter that quietly drops a page produces a
// suite that passes while testing less than it claims, and nothing reports it.
//
// Enumeration runs against manifests written to a temp directory rather than
// against this repo's builds, so these do not need Storybook or Next built and
// cannot go green because a build happened to be lying around.

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MASK,
  DEFAULT_THEME_STORAGE_KEY,
  THEMES,
  applyTheme,
  nextStaticRoutes,
  routeSlug,
  storyUrl,
  storybookStories,
  regionBox,
  sweepChrome,
  sweepPages,
  sweepStorybook,
} from './visual-sweep.mjs';

function storybookBuild(index) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-visual-sb-'));
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index));
  return dir;
}

function nextBuild(routes) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-visual-next-'));
  mkdirSync(join(dir, '.next'));
  writeFileSync(
    join(dir, '.next/prerender-manifest.json'),
    JSON.stringify({ routes: Object.fromEntries(routes.map((route) => [route, {}])) }),
  );
  return dir;
}

/* A fake `test` that records what a sweep registered without running it, plus
   an `expect` shaped like Playwright's for the two calls a sweep makes. */
function recorder() {
  const titles = [];
  const bodies = [];

  const test = (title, body) => {
    titles.push(title);
    bodies.push(body);
  };

  const expectStub = Object.assign(() => ({ toHaveScreenshot: async () => {} }), {
    poll: () => ({ toBe: async () => {} }),
  });

  return { test, expect: expectStub, titles, bodies };
}

/* A `page` that satisfies everything a page sweep drives, and records the
   options the screenshot assertion was called with — which is where `region`
   either became a clip or silently did nothing. `measured` is what the region
   measurement in the browser would have returned.

   `responses` are replayed to the `response` listeners during `goto`, which is
   when a real navigation delivers them. `captured.order` records the calls the
   missing-asset guard depends on being in a particular sequence: the listener
   has to be attached before the navigation it is watching, and the assertion
   has to run before the screenshot rather than after it.

   `childFrames` are the embedded documents `page.frames()` reports alongside
   the main one. Each records the settle it was asked for, which is what
   proves the settle is per frame rather than per page. */
function fakePage(
  measured = { count: 1, x: 10.4, y: 20.2, width: 100.1, height: 200.9 },
  responses = [],
  childFrames = [],
) {
  const captured = { screenshot: null, order: [], settled: [] };
  const frame = { equals: () => true };
  const listeners = [];

  /* Named so a failure says which frame went unwaited rather than printing
     two identical anonymous objects. */
  const settleRecorder = (name) => ({
    name,
    waitForFunction: async () => {
      captured.settled.push(`${name}:images`);
    },
    evaluate: async () => {
      captured.settled.push(`${name}:fonts`);
    },
  });

  const frames = [settleRecorder('main'), ...childFrames.map((name) => settleRecorder(name))];

  const page = {
    clock: { setFixedTime: async () => {} },
    addInitScript: async () => {},
    addStyleTag: async () => {},
    frames: () => frames,
    on: (event, handler) => {
      captured.order.push(`on:${event}`);
      if (event === 'response') listeners.push(handler);
    },
    goto: async () => {
      captured.order.push('goto');
      for (const { url, status } of responses) {
        for (const handler of listeners) handler({ url: () => url, status: () => status });
      }
    },
    waitForLoadState: async () => {},
    waitForFunction: async () => {},
    locator: (selector) => ({ selector }),
    screenshot: async () => frame,
    /* The region measurement is the only evaluate a sweep passes an argument
       to; the settle's frame-promotion pass passes none. */
    evaluate: async (_fn, arg) => (arg === undefined ? undefined : measured),
  };

  const expectStub = Object.assign(
    () => ({
      toHaveScreenshot: async (_name, options) => {
        captured.order.push('screenshot');
        captured.screenshot = options;
      },
    }),
    { poll: () => ({ toBe: async () => {} }) },
  );

  return { page, expect: expectStub, captured };
}

describe('storybookStories', () => {
  it('enumerates stories from the build, sorted, ignoring autodocs pages', () => {
    const dir = storybookBuild({
      entries: {
        'b--one': { id: 'b--one', title: 'B', name: 'One', type: 'story' },
        'a--two': { id: 'a--two', title: 'A', name: 'Two', type: 'story' },
        'a--docs': { id: 'a--docs', title: 'A', name: 'Docs', type: 'docs' },
      },
    });

    expect(storybookStories({ storybookDir: dir })).toEqual([
      { id: 'a--two', title: 'A', name: 'Two' },
      { id: 'b--one', title: 'B', name: 'One' },
    ]);
  });

  it('says what is missing and what to do about it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-visual-empty-'));

    expect(() => storybookStories({ storybookDir: dir, hint: 'run `pnpm build`' })).toThrow(
      /No Storybook index at .*index\.json[\s\S]*run `pnpm build`/,
    );
  });

  it('refuses to guess where the build is', () => {
    expect(() => storybookStories()).toThrow(/needs a `storybookDir`/);
  });
});

describe('storyUrl', () => {
  it('points at the isolated render, not the Storybook shell', () => {
    expect(storyUrl('http://127.0.0.1:6006', 'atoms-button--primary')).toBe(
      'http://127.0.0.1:6006/iframe.html?id=atoms-button--primary&viewMode=story',
    );
  });

  it('escapes an id that would otherwise break the query string', () => {
    expect(storyUrl('http://host', 'a&b=c')).toContain('id=a%26b%3Dc');
  });
});

describe('nextStaticRoutes', () => {
  it('enumerates pages, sorted', () => {
    const dir = nextBuild(['/patterns/hero', '/', '/components/button']);

    expect(nextStaticRoutes({ appDir: dir })).toEqual([
      '/',
      '/components/button',
      '/patterns/hero',
    ]);
  });

  /* Route handlers serve text and have nothing to render; Next's own /_ pages
     are not reachable by a visitor. Screenshotting either is a baseline of
     nothing that still costs a capture. */
  it('drops route handlers and framework internals', () => {
    const dir = nextBuild([
      '/',
      '/llms.txt',
      '/llms-full.txt',
      '/r/button.json',
      '/_not-found',
      '/_global-error',
    ]);

    expect(nextStaticRoutes({ appDir: dir })).toEqual(['/']);
  });

  it('drops whatever else the caller cannot hold still', () => {
    const dir = nextBuild(['/', '/brand/ui-kits/one', '/brand/colors']);

    expect(
      nextStaticRoutes({ appDir: dir, exclude: (route) => route.startsWith('/brand/ui-kits/') }),
    ).toEqual(['/', '/brand/colors']);
  });

  it('says what is missing and what to do about it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ds-visual-empty-'));

    expect(() => nextStaticRoutes({ appDir: dir })).toThrow(/No prerender manifest at /);
  });

  it('refuses to guess where the build is', () => {
    expect(() => nextStaticRoutes()).toThrow(/needs an `appDir`/);
  });
});

describe('routeSlug', () => {
  it('gives every route a filename that cannot collide', () => {
    expect(routeSlug('/')).toBe('index');
    expect(routeSlug('/components/button')).toBe('components-button');
    expect(routeSlug('/patterns/hero')).toBe('patterns-hero');
  });
});

describe('applyTheme', () => {
  it('registers an init script carrying the theme and the storage key', async () => {
    const addInitScript = vi.fn(async () => {});

    await applyTheme({ addInitScript }, 'dark');

    expect(addInitScript).toHaveBeenCalledWith(expect.any(Function), {
      value: 'dark',
      key: DEFAULT_THEME_STORAGE_KEY,
    });
  });

  it('takes the storage key of a site with its own bootstrap', async () => {
    const addInitScript = vi.fn(async () => {});

    await applyTheme({ addInitScript }, 'light', { storageKey: 'app-theme' });

    expect(addInitScript.mock.calls[0][1]).toEqual({ value: 'light', key: 'app-theme' });
  });

  /* The design system opts into dark with an attribute and does not key off
     prefers-color-scheme, so a suite that relied on Playwright's colorScheme
     option would produce two identical light baselines labelled differently. */
  it('drives the attribute the tokens actually respond to', async () => {
    const addInitScript = vi.fn(async () => {});

    await applyTheme({ addInitScript }, 'dark');

    expect(String(addInitScript.mock.calls[0][0])).toContain('data-theme');
  });
});

describe('sweepStorybook', () => {
  const stories = [
    { id: 'a--one', title: 'A', name: 'One' },
    { id: 'b--two', title: 'B', name: 'Two' },
  ];

  it('registers every story in every theme', () => {
    const { test, expect: expectStub, titles } = recorder();

    sweepStorybook({ test, expect: expectStub, baseUrl: 'http://sb', stories });

    expect(titles).toEqual(['a--one · light', 'a--one · dark', 'b--two · light', 'b--two · dark']);
  });

  it('lets the caller name the tests, which is how a project tags a subset', () => {
    const { test, expect: expectStub, titles } = recorder();

    sweepStorybook({
      test,
      expect: expectStub,
      baseUrl: 'http://sb',
      stories: [stories[0]],
      themes: ['light'],
      title: (story, theme) => `${story.id} ${theme} @wide`,
    });

    expect(titles).toEqual(['a--one light @wide']);
  });

  /* A sweep that registers nothing looks exactly like a sweep that passed. */
  it('refuses an empty subject list', () => {
    const { test, expect: expectStub } = recorder();

    expect(() =>
      sweepStorybook({ test, expect: expectStub, baseUrl: 'http://sb', stories: [] }),
    ).toThrow(/registers no tests/);
  });

  it('refuses to run without the harness passed in', () => {
    expect(() => sweepStorybook({ baseUrl: 'http://sb', stories })).toThrow(
      /needs Playwright's `test` and `expect`/,
    );
  });

  it('refuses to run without somewhere to point', () => {
    const { test, expect: expectStub } = recorder();

    expect(() => sweepStorybook({ test, expect: expectStub, stories })).toThrow(
      /needs a `baseUrl`/,
    );
  });
});

describe('sweepPages', () => {
  const routes = ['/', '/components/button'];

  it('registers every route in every theme', () => {
    const { test, expect: expectStub, titles } = recorder();

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes });

    expect(titles).toEqual([
      '/ · light',
      '/ · dark',
      '/components/button · light',
      '/components/button · dark',
    ]);
  });

  it('refuses an empty subject list', () => {
    const { test, expect: expectStub } = recorder();

    expect(() =>
      sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: [] }),
    ).toThrow(/registers no tests/);
  });

  it('frames the whole page when no region is named', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub, captured } = fakePage();

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });
    await bodies[0]({ page });

    expect(captured.screenshot.fullPage).toBe(true);
    expect(captured.screenshot.clip).toBeUndefined();
  });

  /* The load-bearing claim of the whole clipping decision: chrome outside the
     region cannot fail a page shot, because it is outside the frame. A `region`
     that quietly resolved to no clip would leave the fan-out exactly where it
     was, and every page shot would still pass its own comparison — nothing
     downstream would report it. */
  it('clips to the named region, in document space and whole pixels', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub, captured } = fakePage();

    sweepPages({
      test,
      expect: expectStub,
      baseUrl: 'http://docs',
      routes: ['/'],
      region: 'main',
    });
    await bodies[0]({ page });

    expect(captured.screenshot.fullPage).toBe(true);
    /* Rounded outward from { x: 10.4, y: 20.2, width: 100.1, height: 200.9 }. */
    expect(captured.screenshot.clip).toEqual({ x: 10, y: 20, width: 101, height: 202 });
  });

  /* An <iframe> has its own document, and `page.evaluate`/`page.waitForFunction`
     only ever reach the main one. While the settle was written against the page,
     an embedded document's images and `@font-face` rules were awaited by
     nothing — the gap that made /brand/guidelines land in one of two stable end
     states and never converge on a regenerated baseline (#203).

     Asserted per frame rather than by a call count, so a settle that ran twice
     against the main frame and never touched the children cannot pass. */
  it('settles every frame, not just the main one', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub, captured } = fakePage(undefined, [], ['card-1', 'card-2']);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });
    await bodies[0]({ page });

    expect(captured.settled).toEqual([
      'main:images',
      'main:fonts',
      'card-1:images',
      'card-1:fonts',
      'card-2:images',
      'card-2:fonts',
    ]);
  });

  /* A frame can detach between being listed and being asked. One that no longer
     exists cannot hold pixels still, so it must not take the whole sweep down
     with it — and the frames after it still have to be settled. */
  it('keeps settling when a frame detaches mid-wait', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub, captured } = fakePage(undefined, [], ['gone', 'survivor']);

    const detached = page.frames()[1];
    detached.waitForFunction = async () => {
      throw new Error('Frame was detached');
    };

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });
    await expect(bodies[0]({ page })).resolves.not.toThrow();

    expect(captured.settled).toEqual([
      'main:images',
      'main:fonts',
      'survivor:images',
      'survivor:fonts',
    ]);
  });
});

describe('regionBox', () => {
  const page = (measured) => ({ evaluate: async () => measured });

  it('rounds outward, so a fractional length cannot crop the region', async () => {
    const box = await regionBox(
      page({ count: 1, x: 10.4, y: 20.2, width: 100.1, height: 200.9 }),
      'main',
    );

    expect(box).toEqual({ x: 10, y: 20, width: 101, height: 202 });
  });

  /* Both of these would otherwise degrade into a shot that passes: no match
     captures the whole page (the fan-out back, silently), and a zero-sized
     match captures nothing and compares clean forever. */
  it('refuses a selector that matches nothing', async () => {
    await expect(regionBox(page({ count: 0 }), '.gone')).rejects.toThrow(/matched 0 elements/);
  });

  it('refuses a selector that matches several', async () => {
    await expect(regionBox(page({ count: 3 }), 'section')).rejects.toThrow(/matched 3 elements/);
  });

  it('refuses a region with no area', async () => {
    await expect(
      regionBox(page({ count: 1, x: 0, y: 0, width: 0, height: 0 }), '.site-sidebar'),
    ).rejects.toThrow(/no area/);
  });
});

describe('sweepChrome', () => {
  const regions = [
    { name: 'header', selector: '.site-header' },
    { name: 'sidebar', selector: '.site-sidebar' },
  ];

  it('names its shots in the route namespace, so they map like a page does', () => {
    const { test, expect: expectStub, titles } = recorder();

    sweepChrome({ test, expect: expectStub, baseUrl: 'http://docs', regions });

    expect(titles).toEqual([
      '/chrome/header · light',
      '/chrome/header · dark',
      '/chrome/sidebar · light',
      '/chrome/sidebar · dark',
    ]);
  });

  it('clips to the region it was given', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub, captured } = fakePage();

    sweepChrome({
      test,
      expect: expectStub,
      baseUrl: 'http://docs',
      route: '/components/button',
      regions: [regions[0]],
      themes: ['light'],
    });
    await bodies[0]({ page });

    expect(captured.screenshot.clip).toEqual({ x: 10, y: 20, width: 101, height: 202 });
  });

  it('refuses an empty region list', () => {
    const { test, expect: expectStub } = recorder();

    expect(() =>
      sweepChrome({ test, expect: expectStub, baseUrl: 'http://docs', regions: [] }),
    ).toThrow(/registers no tests/);
  });

  it('refuses a region missing its name or its selector', () => {
    const { test, expect: expectStub } = recorder();

    expect(() =>
      sweepChrome({
        test,
        expect: expectStub,
        baseUrl: 'http://docs',
        regions: [{ selector: '.site-header' }],
      }),
    ).toThrow(/needs both a `name` and a `selector`/);
  });
});

describe('the shared defaults', () => {
  it('covers both themes, and cannot be reordered by one suite for another', () => {
    expect(THEMES).toEqual(['light', 'dark']);
    expect(Object.isFrozen(THEMES)).toBe(true);
  });

  it('masks the shimmer that no amount of settling holds still', () => {
    expect(DEFAULT_MASK).toContain('.ds-skeleton');
    expect(Object.isFrozen(DEFAULT_MASK)).toBe(true);
  });
});

/* A served-off-disk asset that is not on disk renders as a stable empty box,
   and a stable empty box compares equal to itself forever. Once a baseline of
   the empty state exists, no pixel comparison can ever report it — so the only
   place this class of defect can be caught is the network, before the shot is
   taken. See issue #149, where five /brand routes were shot against assets the
   sweep container never received. */
describe('the missing-asset guard', () => {
  const missing = [{ url: 'http://docs/brand/wordmark.svg', status: 404 }];

  it('fails the shot when a same-origin request answers 404', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub } = fakePage(undefined, missing);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });

    await expect(bodies[0]({ page })).rejects.toThrow(/brand\/wordmark\.svg/);
  });

  /* The load-bearing ordering claim, and the reason this is a guard rather than
     a report. CI mints a baseline for any shot that does not have one yet, so a
     guard that fired after the capture would still let a first-shot route record
     its broken state as truth — the exact failure #149 was reopened for. If a
     refactor ever moves the assertion below the screenshot, this is what says so. */
  it('fails before the screenshot is taken, so the empty state is never minted', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub, captured } = fakePage(undefined, missing);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });

    await expect(bodies[0]({ page })).rejects.toThrow();
    expect(captured.screenshot).toBeNull();
    expect(captured.order).not.toContain('screenshot');
  });

  /* A listener attached after the navigation it is watching sees nothing, and
     an guard that sees nothing passes. */
  it('starts listening before the navigation it is watching', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub, captured } = fakePage();

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });
    await bodies[0]({ page });

    /* Asserted as a prefix rather than with two indexOf calls: a listener that
       was never attached indexes as -1, which compares "before" everything and
       passes a test that was meant to prove it ran. */
    expect(captured.order.slice(0, 2)).toEqual(['on:response', 'goto']);
  });

  /* The docs site renders an avatar demo against i.pravatar.cc. A blanket rule
     would tie the visual suite to a third-party image host's uptime, which is a
     flake, not a defect. Only assets this site is responsible for serving. */
  it('ignores a cross-origin failure, which is not this site to fix', async () => {
    const { test, bodies } = recorder();
    const {
      page,
      expect: expectStub,
      captured,
    } = fakePage(undefined, [{ url: 'https://i.pravatar.cc/80?img=12', status: 404 }]);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });
    await bodies[0]({ page });

    expect(captured.screenshot).not.toBeNull();
  });

  it('lets a same-origin success through', async () => {
    const { test, bodies } = recorder();
    const {
      page,
      expect: expectStub,
      captured,
    } = fakePage(undefined, [
      { url: 'http://docs/brand/wordmark.svg', status: 200 },
      { url: 'http://docs/somewhere', status: 304 },
    ]);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });
    await bodies[0]({ page });

    expect(captured.screenshot).not.toBeNull();
  });

  /* A 500 on an asset is the same defect wearing a different number: the page
     paints without it either way. */
  it('catches any failing status, not only 404', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub } = fakePage(undefined, [
      { url: 'http://docs/brand/deck.pdf', status: 500 },
    ]);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });

    await expect(bodies[0]({ page })).rejects.toThrow(/500/);
  });

  it('exempts a URL matched by `allowMissing`, as a substring or a pattern', async () => {
    for (const allowMissing of [['/brand/wordmark.svg'], [/wordmark/]]) {
      const { test, bodies } = recorder();
      const { page, expect: expectStub, captured } = fakePage(undefined, missing);

      sweepPages({
        test,
        expect: expectStub,
        baseUrl: 'http://docs',
        routes: ['/'],
        allowMissing,
      });
      await bodies[0]({ page });

      expect(captured.screenshot).not.toBeNull();
    }
  });

  it('names every failure, not just the first', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub } = fakePage(undefined, [
      { url: 'http://docs/brand/one.svg', status: 404 },
      { url: 'http://docs/brand/two.svg', status: 404 },
    ]);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });

    await expect(bodies[0]({ page })).rejects.toThrow(/one\.svg[\s\S]*two\.svg/);
  });

  /* Reporting the same URL once per retry would bury the distinct failures. */
  it('reports a repeated URL once', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub } = fakePage(undefined, [
      { url: 'http://docs/brand/one.svg', status: 404 },
      { url: 'http://docs/brand/one.svg', status: 404 },
    ]);

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });

    const error = await bodies[0]({ page }).catch((thrown) => thrown);
    expect(error.message.match(/one\.svg/g)).toHaveLength(1);
  });

  /* Degrading quietly here would reintroduce the bug in the guard itself: a
     sweep that cannot listen would pass while checking nothing, which is
     indistinguishable from a sweep with no missing assets. */
  it('refuses to run against a page it cannot listen on, rather than skipping the check', async () => {
    const { test, bodies } = recorder();
    const { page, expect: expectStub } = fakePage();
    delete page.on;

    sweepPages({ test, expect: expectStub, baseUrl: 'http://docs', routes: ['/'] });

    await expect(bodies[0]({ page })).rejects.toThrow(/on\(/);
  });

  it('guards the storybook and chrome sweeps on the same terms', async () => {
    const storybook = recorder();
    const storybookPage = fakePage(undefined, [{ url: 'http://sb/assets/logo.svg', status: 404 }]);
    sweepStorybook({
      test: storybook.test,
      expect: storybookPage.expect,
      baseUrl: 'http://sb',
      stories: [{ id: 'a--one', title: 'A', name: 'One' }],
    });
    await expect(storybook.bodies[0]({ page: storybookPage.page })).rejects.toThrow(/logo\.svg/);

    const chrome = recorder();
    const chromePage = fakePage(undefined, missing);
    sweepChrome({
      test: chrome.test,
      expect: chromePage.expect,
      baseUrl: 'http://docs',
      regions: [{ name: 'header', selector: 'header' }],
    });
    await expect(chrome.bodies[0]({ page: chromePage.page })).rejects.toThrow(/wordmark\.svg/);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
