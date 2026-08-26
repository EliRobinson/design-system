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

export interface TouchTargetViolation extends Violation {
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
  width: number;
  height: number;
  unmeasurable: true;
}

export interface HitAreaViolation extends Violation {
  covers: string;
}

export interface ContrastViolation extends Violation {
  contrast: string;
}

export interface TouchTargetOptions {
  /** Which controls to measure. Defaults to PRIMARY_CONTROL_SELECTOR. */
  selector?: string;
  /** Controls held to the dense scale instead. Defaults to DENSE_AFFORDANCE_SELECTOR. */
  exempt?: string;
  /** Minimum px in each axis. Defaults to 44. */
  minimum?: number;
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
export declare const PRIMARY_CONTROL_SELECTOR: string;
export declare const DENSE_AFFORDANCE_SELECTOR: string;

export declare function checkTouchTargets(
  page: PageLike,
  options?: TouchTargetOptions,
): Promise<Array<TouchTargetViolation | UnmeasurableTouchTarget>>;

export declare function checkHitAreaOverlap(
  page: PageLike,
  options?: { selector?: string },
): Promise<HitAreaViolation[]>;

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
