/**
 * Storybook and page sweeps for a visual-regression suite. Playwright's `test`
 * and `expect` are injected rather than imported, so the types here stay
 * structural and @playwright/test stays an optional peer.
 *
 * The sweeps are generic over the page type: a caller passing Playwright's own
 * `test` gets its full `Page` back in every hook, rather than the narrowed
 * shape these functions happen to need.
 */

export type Theme = 'light' | 'dark';

export interface Story {
  id: string;
  title: string;
  name: string;
}

/** The parts of a Playwright `Page` a sweep actually drives. */
export interface SweepPage {
  goto(url: string): Promise<unknown>;
  locator(selector: string): unknown;
  /* Returns a Disposable in newer Playwright and void in older ones, so this
     stays `unknown` rather than pinning either. */
  addInitScript(script: unknown, arg?: unknown): Promise<unknown>;
  addStyleTag(options: { content: string }): Promise<unknown>;
  evaluate(fn: unknown, arg?: unknown): Promise<unknown>;
  waitForFunction(fn: unknown, arg?: unknown): Promise<unknown>;
  waitForLoadState(state?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void>;
  screenshot(options?: unknown): Promise<{ equals(other: never): boolean }>;
  clock: { setFixedTime(time: number | string | Date): Promise<void> };
}

/** Playwright's `test`, narrowed to the one call form a sweep uses. */
export interface SweepTest<TPage> {
  (title: string, body: (args: { page: TPage }) => Promise<void> | void): void;
}

export interface ScreenshotAssertion {
  toHaveScreenshot(name: string, options?: Record<string, unknown>): Promise<void>;
}

export interface PollAssertion<T> {
  toBe(expected: T): Promise<void>;
}

/** Playwright's `expect`, narrowed to what a sweep uses. */
export interface SweepExpect<TPage> {
  (page: TPage): ScreenshotAssertion;
  poll<T>(
    poller: () => T | Promise<T>,
    options?: { intervals?: number[]; timeout?: number },
  ): PollAssertion<T>;
}

export interface EnumerateOptions {
  /** Appended to the "no manifest" error, e.g. the command that builds it. */
  hint?: string;
}

export interface StorybookStoriesOptions extends EnumerateOptions {
  /** The built Storybook output, resolved against the working directory. */
  storybookDir: string;
}

export interface NextStaticRoutesOptions extends EnumerateOptions {
  /** The Next app that was built, resolved against the working directory. */
  appDir: string;
  /** Dropped on top of the built-in filtering. Return true to skip a route. */
  exclude?: (route: string) => boolean;
}

export interface ThemeOptions {
  /** localStorage key the site's own theme bootstrap reads. */
  storageKey?: string;
}

export interface StablePixelsOptions<TPage> {
  expect: SweepExpect<TPage>;
  /** Must match the assertion that follows. Defaults to false. */
  fullPage?: boolean;
  /** Defaults to 60_000. */
  timeout?: number;
}

interface SweepOptions<TPage> {
  test: SweepTest<TPage>;
  expect: SweepExpect<TPage>;
  /** Origin the built output is served from, with no trailing slash. */
  baseUrl: string;
  /** Defaults to THEMES. */
  themes?: readonly Theme[];
  themeStorageKey?: string;
}

export interface SweepStorybookOptions<TPage> extends SweepOptions<TPage> {
  stories: readonly Story[];
  /** Defaults to `#storybook-root`. */
  rootSelector?: string;
  title?: (story: Story, theme: Theme) => string;
  name?: (story: Story, theme: Theme) => string;
  /** Runs after the screenshot, so a focus check cannot alter the baseline. */
  afterCapture?: (
    page: TPage,
    subject: { story: Story; theme: Theme },
  ) => Promise<unknown> | unknown;
}

export interface SweepPagesOptions<TPage> extends SweepOptions<TPage> {
  routes: readonly string[];
  /** Defaults to true. */
  fullPage?: boolean;
  /** Selectors masked out of every capture. Defaults to DEFAULT_MASK. */
  mask?: readonly string[];
  title?: (route: string, theme: Theme) => string;
  name?: (route: string, theme: Theme) => string;
  afterCapture?: (
    page: TPage,
    subject: { route: string; theme: Theme },
  ) => Promise<unknown> | unknown;
}

export declare const THEMES: readonly Theme[];
export declare const DEFAULT_THEME_STORAGE_KEY: string;
export declare const DEFAULT_MASK: readonly string[];

/** Every story in a built Storybook, sorted by id. */
export declare function storybookStories(options: StorybookStoriesOptions): Story[];

/** The isolated render of one story, without Storybook's own UI around it. */
export declare function storyUrl(baseUrl: string, id: string): string;

/** Every prerendered page of a built Next app, sorted, minus non-visual routes. */
export declare function nextStaticRoutes(options: NextStaticRoutesOptions): string[];

/** A filename-safe name for a route: `/` is `index`, `/a/b` is `a-b`. */
export declare function routeSlug(route: string): string;

/** Selects a theme. Must be called before `page.goto`. */
export declare function applyTheme(
  page: SweepPage,
  theme: Theme,
  options?: ThemeOptions,
): Promise<void>;

/** Holds until two consecutive captures of the page agree. */
export declare function waitForStablePixels<TPage extends SweepPage>(
  page: TPage,
  options: StablePixelsOptions<TPage>,
): Promise<void>;

/** Registers one test per story per theme. */
export declare function sweepStorybook<TPage extends SweepPage>(
  options: SweepStorybookOptions<TPage>,
): void;

/** Registers one test per route per theme. */
export declare function sweepPages<TPage extends SweepPage>(
  options: SweepPagesOptions<TPage>,
): void;
