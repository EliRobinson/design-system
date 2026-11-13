/* The shared browser bootstrap (tests/support/boot-browser.mjs, #402) with a
 * fake Playwright and a fake Vitest, so no real browser starts. It lives here
 * because tests/support/ belongs to no project, and this is the repo-local
 * suite that `pnpm test` reaches.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_BUDGET, bootBrowser } from '../tests/support/boot-browser.mjs';

function fakeVitest() {
  const teardowns = [];
  const describeFn = () => {};
  describeFn.skip = () => {};
  return {
    vitest: { afterAll: (fn, timeout) => teardowns.push({ fn, timeout }), describe: describeFn },
    teardowns,
  };
}

function fakeBrowser() {
  return { close: vi.fn(async () => {}) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bootBrowser', () => {
  it('launches the named engine and registers its teardown on the budget', async () => {
    const browser = fakeBrowser();
    const webkit = { launch: vi.fn(async () => browser) };
    const chromium = { launch: vi.fn(async () => fakeBrowser()) };
    const { vitest, teardowns } = fakeVitest();

    const booted = await bootBrowser('engine', {
      vitest,
      playwright: async () => ({ chromium, webkit }),
      engine: 'webkit',
    });

    expect(webkit.launch).toHaveBeenCalledOnce();
    expect(chromium.launch).not.toHaveBeenCalled();
    expect(booted.browser).toBe(browser);
    expect(booted.describeBrowser).toBe(vitest.describe);
    expect(teardowns).toHaveLength(1);
    expect(teardowns[0].timeout).toBe(BROWSER_BUDGET);

    await teardowns[0].fn();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it('skips loudly when playwright is not installed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { vitest, teardowns } = fakeVitest();

    const booted = await bootBrowser('missing', {
      vitest,
      playwright: async () => {
        throw new Error('Cannot find package');
      },
    });

    expect(booted.browser).toBeNull();
    expect(booted.describeBrowser).toBe(vitest.describe.skip);
    expect(warn).toHaveBeenCalledWith('Skipping missing tests: playwright is not installed');
    await teardowns[0].fn();
  });

  it('skips with the launch error when the browser fails to start', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { vitest } = fakeVitest();
    const chromium = {
      launch: async () => {
        throw new Error('no executable');
      },
    };

    const booted = await bootBrowser('broken', { vitest, playwright: async () => ({ chromium }) });

    expect(booted.browser).toBeNull();
    expect(warn).toHaveBeenCalledWith('Skipping broken tests: no executable');
  });

  it('gives up on a hung launch, and closes the browser if it lands late', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { vitest } = fakeVitest();
    const late = fakeBrowser();
    let land;
    const chromium = { launch: () => new Promise((resolve) => (land = resolve)) };

    const booted = await bootBrowser('hung', {
      vitest,
      playwright: async () => ({ chromium }),
      budget: 20,
    });

    expect(booted.browser).toBeNull();
    expect(booted.describeBrowser).toBe(vitest.describe.skip);
    expect(warn).toHaveBeenCalledWith('Skipping hung tests: chromium.launch() exceeded 20ms');

    land(late);
    await vi.waitFor(() => expect(late.close).toHaveBeenCalledOnce());
  });
});
