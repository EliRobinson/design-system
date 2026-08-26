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
   measurement in the browser would have returned. */
function fakePage(measured = { count: 1, x: 10.4, y: 20.2, width: 100.1, height: 200.9 }) {
  const captured = { screenshot: null };
  const frame = { equals: () => true };

  const page = {
    clock: { setFixedTime: async () => {} },
    addInitScript: async () => {},
    addStyleTag: async () => {},
    goto: async () => {},
    waitForLoadState: async () => {},
    waitForFunction: async () => {},
    locator: (selector) => ({ selector }),
    screenshot: async () => frame,
    /* The region measurement is the only evaluate a sweep passes an argument
       to; the settle loop's font wait passes none. */
    evaluate: async (_fn, arg) => (arg === undefined ? undefined : measured),
  };

  const expectStub = Object.assign(
    () => ({
      toHaveScreenshot: async (_name, options) => {
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

afterEach(() => {
  vi.restoreAllMocks();
});
