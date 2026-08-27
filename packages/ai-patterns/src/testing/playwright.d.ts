/**
 * Runtime checks for the contracts in `@elirobinson/ai-patterns/contracts` that
 * only a browser can settle. Written against a Playwright `Page`; the type is
 * kept structural so this file needs no dependency on @playwright/test.
 */

export interface PageLike {
  evaluate(fn: unknown, arg?: unknown): Promise<unknown>;
  addScriptTag(options: { content: string }): Promise<unknown>;
  locator(selector: string): unknown;
  keyboard: { press(key: string): Promise<void> };
}

export interface Violation {
  /** A readable handle for the offending element, e.g. `button.ds-button "Save"`. */
  element: string;
  message: string;
}

/**
 * Which of the two floors this control was measured against. Read this rather
 * than parsing `message` for its prefix.
 */
export type TouchTargetContract =
  | 'touch-target-primary'
  | 'touch-target-dense'
  | 'touch-target-unmeasurable';

export interface TouchTargetViolation extends Violation {
  contract: 'touch-target-primary' | 'touch-target-dense';
  /** The floor actually applied to this control: 44 primary, 24 dense. */
  minimum: number;
  width: number;
  height: number;
  /** The control's own hit area, including padding and any bounded overlay. */
  effectiveWidth: number;
  effectiveHeight: number;
  /**
   * The roomiest `<label>` that activates this control, when it has one. A
   * control passes on either its own hit area or a single label's, so these are
   * only present on a violation — meaning both surfaces were too small.
   */
  labelWidth?: number;
  labelHeight?: number;
}

/**
 * Not a size violation: a control the check could not measure at all. The
 * browser routed nothing to its centre even though its box is on screen, so no
 * effective hit area was obtained and none is reported. `width`/`height` are
 * the painted box, which was obtained.
 */
export interface UnmeasurableTouchTarget extends Violation {
  contract: 'touch-target-unmeasurable';
  /** The floor it would have been measured against, had it been measurable. */
  minimum: number;
  width: number;
  height: number;
  unmeasurable: true;
}

export interface HitAreaViolation extends Violation {
  /** The sibling this control's hit area was found to cover. */
  covers: string;
}

/**
 * Not an overlap violation: a sibling the check could not probe at all. It is
 * on screen and the browser still routed nothing to its centre, so whether the
 * control covers it was never established. Reported rather than passed —
 * treating an unanswered probe as "no overlap" is the silent false negative
 * that made every sibling below the fold look clean.
 */
export interface UnmeasurableHitArea extends Violation {
  /** The sibling that could not be probed. */
  covers: string;
  unmeasurable: true;
}

export interface ContrastViolation extends Violation {
  contrast: string;
}

export interface TouchTargetOptions {
  /** Which controls to measure. Defaults to PRIMARY_CONTROL_SELECTOR. */
  selector?: string;
  /**
   * Controls measured against the dense floor instead of `minimum`. Defaults to
   * DENSE_AFFORDANCE_SELECTOR. Matching is not an exemption from measurement —
   * pass `''` to hold every control to `minimum`.
   */
  exempt?: string;
  /** Minimum px in each axis. Defaults to 44. */
  minimum?: number;
  /**
   * Minimum px in each axis for a control matching `exempt`. Defaults to 24,
   * the WCAG 2.2 AA floor (SC 2.5.8). Clamped to `minimum`, since a relaxation
   * cannot be stricter than the floor it relaxes.
   */
  denseMinimum?: number;
}

export interface FocusVisibleOptions {
  selector?: string;
  /** Drive real Tab presses instead of programmatic focus. */
  useKeyboard?: boolean;
}

export interface ContrastOptions {
  include?: string;
  exclude?: string[];
  level?: 'AA' | 'AAA';
}

export interface ContractOptions {
  touchTargets?: TouchTargetOptions | false;
  hitAreaOverlap?: { selector?: string } | false;
  focusVisible?: FocusVisibleOptions | false;
  contrast?: ContrastOptions | false;
}

export declare const MINIMUM_TOUCH_TARGET: number;
export declare const MINIMUM_TOUCH_TARGET_DENSE: number;
export declare const PRIMARY_CONTROL_SELECTOR: string;
export declare const DENSE_AFFORDANCE_SELECTOR: string;

export declare function checkTouchTargets(
  page: PageLike,
  options?: TouchTargetOptions,
): Promise<Array<TouchTargetViolation | UnmeasurableTouchTarget>>;

export declare function checkHitAreaOverlap(
  page: PageLike,
  options?: { selector?: string },
): Promise<Array<HitAreaViolation | UnmeasurableHitArea>>;

export declare function checkFocusVisible(
  page: PageLike,
  options?: FocusVisibleOptions,
): Promise<Violation[]>;

export declare function checkContrast(
  page: PageLike,
  options?: ContrastOptions,
): Promise<ContrastViolation[]>;

/** Runs every check and throws with all violations at once. */
export declare function expectDesignSystemContracts(
  page: PageLike,
  options?: ContractOptions,
): Promise<Violation[]>;
