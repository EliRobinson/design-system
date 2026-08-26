/**
 * The determinism contract of a visual-regression suite, as a Playwright config
 * preset. Types are kept structural so this file needs no dependency on
 * @playwright/test, which stays an optional peer.
 */

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Just enough of a Playwright `Page` to freeze its clock. */
export interface ClockPage {
  clock: { setFixedTime(time: number | string | Date): Promise<void> };
}

export interface BaselineGuardOptions {
  /** Defaults to process.argv. */
  argv?: readonly string[];
  /** Defaults to process.env. */
  env?: Record<string, string | undefined>;
  /** Named in the refusal message. Defaults to `pnpm test:visual:update`. */
  updateCommand?: string;
}

/** One reporter entry — Playwright's own `[name]` / `[name, options]` shape. */
export type ReporterEntry = readonly [string] | readonly [string, Record<string, unknown>];

export interface ScreenshotDeterminism {
  animations: 'disabled';
  /** 0. A colour tolerance would hide a one-step shift inside a token ramp. */
  threshold: number;
  /** A small budget for rasteriser nondeterminism. See the comment in visual-config.mjs. */
  maxDiffPixels: number;
  /**
   * Left `undefined` on purpose: Playwright takes `Math.min` of the two budgets,
   * so a ratio of 0 here would cancel `maxDiffPixels` back to 0.
   */
  maxDiffPixelRatio: number | undefined;
}

/** What the preset contributes on top of whatever the caller passes. */
export interface VisualDeterminism {
  outputDir: string;
  snapshotPathTemplate: string;
  updateSnapshots: 'none' | undefined;
  timeout: number;
  fullyParallel: boolean;
  forbidOnly: boolean;
  retries: number;
  reporter: ReporterEntry[];
  use: {
    viewport: Viewport;
    deviceScaleFactor: number;
    locale: string;
    timezoneId: string;
    serviceWorkers: 'block';
  };
  expect: {
    timeout: number;
    toHaveScreenshot: ScreenshotDeterminism;
  };
}

export declare const VISUAL_CONTAINER_ENV: string;
export declare const WIDE_VIEWPORT: Viewport;
export declare const NARROW_VIEWPORT: Viewport;
export declare const FIXED_TIME: Date;
export declare const SNAPSHOT_PATH_TEMPLATE: string;

export declare function inVisualContainer(env?: Record<string, string | undefined>): boolean;

/** Throws when `--update-snapshots` is used outside the pinned container. */
export declare function assertContainedBaselineUpdate(options?: BaselineGuardOptions): void;

/**
 * The determinism contract merged with the caller's own config. Pass the result
 * to Playwright's `defineConfig`.
 */
export declare function defineVisualConfig<T extends object>(
  overrides?: T,
  guard?: BaselineGuardOptions,
): Omit<VisualDeterminism, Exclude<keyof T, 'use' | 'expect'>> & T;

/** Freezes the page's clock at FIXED_TIME. Call before the test navigates. */
export declare function applyFixedClock(
  page: ClockPage,
  time?: number | string | Date,
): Promise<void>;
