/**
 * Finds components whose rendering depends on a UA-stylesheet default that a
 * consumer's CSS reset removes — the class of bug behind #78 and #126.
 *
 * The page type is structural rather than imported, so @playwright/test stays
 * an optional peer: anything exposing `evaluate` and `addStyleTag` works.
 */

export interface PreflightSweepPage {
  evaluate<Result, Arg>(fn: (arg: Arg) => Result, arg: Arg): Promise<Result>;
  addStyleTag(options: { content: string }): Promise<unknown>;
}

export interface PreflightFinding {
  /** A readable locator: `#id`, `tag.class.class`, or the bare tag. */
  selector: string;
  tag: string;
  className: string;
  /** What moved, e.g. `['h 44.0->49.1']`. Position is relative to the root. */
  changes: string[];
}

export interface PreflightSweepOptions {
  /**
   * The reset to apply. Pass the consumer's real one — for Tailwind, the
   * contents of `tailwindcss/preflight.css` — rather than an approximation,
   * since the point is what that consumer actually ships.
   */
  resetCss: string;
  /** Subtree to measure. Defaults to `body`; point it at a story root. */
  rootSelector?: string;
  /** Pixel tolerance for sub-pixel jitter. Defaults to 0.5. */
  tolerance?: number;
}

export function findPreflightSensitiveElements(
  page: PreflightSweepPage,
  options: PreflightSweepOptions,
): Promise<PreflightFinding[]>;
