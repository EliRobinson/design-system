/* The shared page server (tests/support/open-page.mjs, #419) with a fake
 * browser, so no real browser starts. It lives here for the same reason as
 * boot-browser.test.mjs: tests/support/ belongs to no project.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { openPage } from '../tests/support/open-page.mjs';

const ORIGIN = 'https://open-page.test';
const dir = mkdtempSync(join(tmpdir(), 'open-page-'));
writeFileSync(join(dir, 'tokens.css'), 'fallback');
writeFileSync(join(dir, 'face.woff2'), 'font');
writeFileSync(join(dir, 'named.css'), 'named');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

/* A browser whose page records the route handler and the URL it was sent to. */
function fakeBrowser() {
  const page = { route: vi.fn(), goto: vi.fn(async () => {}) };
  const context = { newPage: vi.fn(async () => page), close: vi.fn(async () => {}) };
  const browser = { newContext: vi.fn(async () => context) };
  return { browser, context, page };
}

/* Ask the recorded handler for `path` and return what it fulfilled. */
async function request(page, path) {
  const [pattern, handler] = page.route.mock.calls[0];
  expect(pattern).toBe(`${ORIGIN}/**`);
  let fulfilled;
  await handler({
    request: () => ({ url: () => `${ORIGIN}/${path}` }),
    fulfill: (response) => {
      fulfilled = response;
    },
  });
  return { ...fulfilled, body: String(fulfilled.body) };
}

describe('openPage', () => {
  it('serves the html, then named files, then the fallback folder, else 404', async () => {
    const { browser, context, page } = fakeBrowser();
    const options = { reducedMotion: 'reduce' };

    const result = await openPage(
      browser,
      {
        origin: ORIGIN,
        html: '<p>hi</p>',
        files: { 'site.css': join(dir, 'named.css') },
        fallbackDir: dir,
        context: options,
      },
      async (served) => {
        expect(served).toBe(page);
        return 'ran';
      },
    );

    expect(result).toBe('ran');
    expect(browser.newContext).toHaveBeenCalledWith(options);
    expect(page.goto).toHaveBeenCalledWith(`${ORIGIN}/index.html`);
    expect(await request(page, 'index.html')).toEqual({
      contentType: 'text/html',
      body: '<p>hi</p>',
    });
    expect(await request(page, 'site.css')).toEqual({ contentType: 'text/css', body: 'named' });
    expect(await request(page, 'tokens.css')).toEqual({
      contentType: 'text/css',
      body: 'fallback',
    });
    expect(await request(page, 'face.woff2')).toEqual({ contentType: 'font/woff2', body: 'font' });
    expect(await request(page, 'nope.css')).toEqual({ status: 404, body: '' });
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('closes the context when run throws', async () => {
    const { browser, context } = fakeBrowser();
    const boom = new Error('probe failed');

    await expect(
      openPage(browser, { origin: ORIGIN, html: '', fallbackDir: dir }, async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('throws on a missing named file before it opens anything', async () => {
    const { browser } = fakeBrowser();
    const missing = join(dir, 'missing.css');

    await expect(
      openPage(
        browser,
        { origin: ORIGIN, html: '', files: { 'a.css': missing }, fallbackDir: dir },
        async () => {},
      ),
    ).rejects.toThrow(`openPage: missing file ${missing}`);
    expect(browser.newContext).not.toHaveBeenCalled();
  });
});
