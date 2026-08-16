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
