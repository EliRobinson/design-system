// The half of contracts.json a linter cannot settle.
//
// `minimumTouchTarget`, `focusVisibleRequired` and `contrastLevel` are all
// claims about rendered geometry and computed colour, so the only honest way to
// check them is in a browser. These helpers take a Playwright `page` and return
// violations; drop them into an existing E2E suite rather than standing up a
// separate harness:
//
//   import { expectDesignSystemContracts } from '@elirobinson/ai-patterns/testing/playwright'
//
//   test('home page meets the design system contracts', async ({ page }) => {
//     await page.goto('/')
//     await expectDesignSystemContracts(page)
//   })
//
// Each helper can also be called on its own when a page needs a narrower scope
// or a documented exception.
//
// @playwright/test and axe-core are optional peer dependencies: nothing here is
// imported unless you import this module, and axe-core is only loaded by the
// contrast check. The browser-side code defines its own helpers inline rather
// than eval-ing them, so a page with a strict CSP still works.

/** contracts.json → uiContracts.minimumTouchTarget */
export const MINIMUM_TOUCH_TARGET = 44;

/** contracts.json → touch-target-primary. Controls a finger is expected to hit. */
export const PRIMARY_CONTROL_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  'summary',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
].join(', ');

/**
 * contracts.json → touch-target-dense. Inline affordances that follow the
 * shadcn/MUI scale instead of 44px. Mark your own with
 * `data-touch-target="dense"` rather than growing this list.
 */
export const DENSE_AFFORDANCE_SELECTOR = [
  '[data-touch-target="dense"]',
  '.ds-chip__remove',
  '.ds-search-field__clear',
  '.ds-rating__star',
  '.ds-date-picker__day',
  '.ds-calendar__day',
].join(', ');

const FOCUS_MESSAGE =
  'focusVisibleRequired: focusing this control changes nothing visible. Restore the token focus ring — outline: 2px solid var(--focus-ring) — and delete any `outline: none`.';

const OVERLAP_MESSAGE =
  "hit-area-no-overlap: this control's hit area covers the centre of a sibling. Bound the overlay — stretch it to the container's height rather than using a symmetric negative inset.";

function assertPage(page) {
  if (!page || typeof page.evaluate !== 'function') {
    throw new TypeError(
      'Expected a Playwright Page. Call these helpers with the `page` fixture from @playwright/test.',
    );
  }
}

/**
 * Measures the *effective* hit area, not the painted box: the contract allows a
 * small glyph with padding or a bounded overlay around it, so a control counts
 * as 44x44 when the browser actually routes a hit at the edges of a 44x44 box
 * back to it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.selector] which controls to measure
 * @param {string} [options.exempt] controls held to the dense scale instead
 * @param {number} [options.minimum] px, defaults to the contract's 44
 * @returns {Promise<Array<{ element: string, width: number, height: number, effectiveWidth: number, effectiveHeight: number, message: string }>>}
 */
export async function checkTouchTargets(page, options = {}) {
  assertPage(page);

  const {
    selector = PRIMARY_CONTROL_SELECTOR,
    exempt = DENSE_AFFORDANCE_SELECTOR,
    minimum = MINIMUM_TOUCH_TARGET,
  } = options;

  return page.evaluate(
    ({ selector, exempt, minimum }) => {
      const describe = (element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string' && element.className.trim()
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        const label =
          element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
      };

      const violations = [];

      for (const element of document.querySelectorAll(selector)) {
        if (exempt && element.closest(exempt)) continue;
        if (element.disabled) continue;

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') continue;

        const centreX = rect.left + rect.width / 2;
        const centreY = rect.top + rect.height / 2;

        // Only the control itself or something inside it counts. An *ancestor*
        // answering the hit test means the point missed — and since <body>
        // contains every control, treating ancestors as hits would make every
        // target look infinitely large.
        const hits = (x, y) => {
          const hit = document.elementFromPoint(x, y);
          return hit === element || element.contains(hit);
        };

        // Walk outward from the centre until the browser stops routing hits
        // back here. That is the hit area a finger actually gets, which is what
        // the contract is about — padding and bounded overlays both count.
        const reach = (dx, dy) => {
          let distance = 0;
          for (let step = 1; step <= minimum; step += 1) {
            if (!hits(centreX + dx * step, centreY + dy * step)) break;
            distance = step;
          }
          return distance;
        };

        const effectiveWidth = reach(-1, 0) + reach(1, 0) + 1;
        const effectiveHeight = reach(0, -1) + reach(0, 1) + 1;

        if (effectiveWidth < minimum || effectiveHeight < minimum) {
          violations.push({
            element: describe(element),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            effectiveWidth,
            effectiveHeight,
            message: `touch-target-primary: hit area is ~${effectiveWidth}x${effectiveHeight}, below ${minimum}x${minimum}. Expand it with padding or a bounded overlay — do not inflate the visible control. If this is a dense inline affordance, mark it data-touch-target="dense".`,
          });
        }
      }

      return violations;
    },
    { selector, exempt, minimum },
  );
}

/**
 * contracts.json → hit-area-no-overlap. An expanded hit area must not swallow a
 * neighbour: if a sibling's own centre routes to this control, it has been
 * covered.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.selector]
 * @returns {Promise<Array<{ element: string, covers: string, message: string }>>}
 */
export async function checkHitAreaOverlap(page, options = {}) {
  assertPage(page);
  const { selector = PRIMARY_CONTROL_SELECTOR } = options;

  return page.evaluate(
    ({ selector, message }) => {
      const describe = (element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string' && element.className.trim()
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        const label =
          element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
      };

      const violations = [];

      for (const control of document.querySelectorAll(selector)) {
        for (const sibling of control.parentElement?.children ?? []) {
          if (sibling === control || control.contains(sibling)) continue;

          const rect = sibling.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;

          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );

          if (hit === control || control.contains(hit)) {
            violations.push({ element: describe(control), covers: describe(sibling), message });
          }
        }
      }

      return violations;
    },
    { selector, message: OVERLAP_MESSAGE },
  );
}

/**
 * contracts.json → uiContracts.focusVisibleRequired. Focuses each control and
 * checks that something visible actually changed.
 *
 * Focus is moved programmatically, which Chromium treats as keyboard-like and
 * so matches `:focus-visible`. Pass `useKeyboard: true` to drive real Tab
 * presses when a component's focus styling depends on key events.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.selector]
 * @param {boolean} [options.useKeyboard]
 * @returns {Promise<Array<{ element: string, message: string }>>}
 */
export async function checkFocusVisible(page, options = {}) {
  assertPage(page);
  const { selector = PRIMARY_CONTROL_SELECTOR, useKeyboard = false } = options;

  if (useKeyboard) {
    const controls = page.locator(selector);
    const count = await controls.count();
    const violations = [];

    for (let index = 0; index < count; index += 1) {
      const control = controls.nth(index);
      if (!(await control.isVisible())) continue;

      const before = await control.evaluate(snapshotStyle);
      await control.focus();
      // Leave and re-enter by keyboard so :focus-visible is unambiguous.
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const after = await control.evaluate(snapshotStyle);

      if (before === after) {
        violations.push({
          element: await control.evaluate(describeElement),
          message: FOCUS_MESSAGE,
        });
      }
    }

    return violations;
  }

  return page.evaluate(
    ({ selector, message }) => {
      const describe = (element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes =
          typeof element.className === 'string' && element.className.trim()
            ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
            : '';
        const label =
          element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
        return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
      };

      const snapshot = (element) => {
        const style = getComputedStyle(element);
        return [
          style.outlineStyle,
          style.outlineWidth,
          style.outlineColor,
          style.outlineOffset,
          style.boxShadow,
          style.borderColor,
          style.backgroundColor,
          style.color,
        ].join('|');
      };

      const violations = [];
      const previouslyFocused = document.activeElement;

      for (const element of document.querySelectorAll(selector)) {
        if (element.disabled) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const before = snapshot(element);
        element.focus();
        const after = snapshot(element);
        element.blur();

        if (before === after) violations.push({ element: describe(element), message });
      }

      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      return violations;
    },
    { selector, message: FOCUS_MESSAGE },
  );
}

// Passed to Locator#evaluate, which runs them in the page.
function snapshotStyle(element) {
  const style = getComputedStyle(element);
  return [
    style.outlineStyle,
    style.outlineWidth,
    style.outlineColor,
    style.outlineOffset,
    style.boxShadow,
    style.borderColor,
    style.backgroundColor,
    style.color,
  ].join('|');
}

function describeElement(element) {
  const id = element.id ? `#${element.id}` : '';
  const classes =
    typeof element.className === 'string' && element.className.trim()
      ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
  const label =
    element.getAttribute('aria-label') || (element.textContent || '').trim().slice(0, 40);
  return `${element.tagName.toLowerCase()}${id}${classes}${label ? ` "${label}"` : ''}`;
}

/**
 * contracts.json → uiContracts.contrastLevel. Runs axe-core's colour-contrast
 * rule, which is the WCAG AA implementation everything else defers to.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.include] restrict to a subtree
 * @param {string[]} [options.exclude] subtrees to skip (third-party embeds)
 * @param {'AA' | 'AAA'} [options.level]
 * @returns {Promise<Array<{ element: string, message: string, contrast: string }>>}
 */
export async function checkContrast(page, options = {}) {
  assertPage(page);
  const { include, exclude = [], level = 'AA' } = options;

  let axeSource;
  try {
    const axe = await import('axe-core');
    axeSource = (axe.default ?? axe).source;
  } catch {
    throw new Error(
      'checkContrast() needs axe-core. Install it alongside your E2E suite:\n\n  pnpm add -D axe-core',
    );
  }

  await page.addScriptTag({ content: axeSource });

  return page.evaluate(
    async ({ include, exclude, rule }) => {
      const context = {};
      if (include) context.include = [include];
      if (exclude.length) context.exclude = exclude.map((selector) => [selector]);

      const run = await window.axe.run(Object.keys(context).length ? context : document, {
        runOnly: { type: 'rule', values: [rule] },
      });

      return run.violations.flatMap((violation) =>
        violation.nodes.map((node) => ({
          element: node.target.join(' '),
          message: `contrastLevel: ${violation.help}`,
          contrast: node.failureSummary ?? '',
        })),
      );
    },
    { include, exclude, rule: level === 'AAA' ? 'color-contrast-enhanced' : 'color-contrast' },
  );
}

/**
 * Every browser-settled contract in one call. Throws with all violations at
 * once, so a run reports the whole picture instead of the first failure.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {object|false} [options.touchTargets] options, or false to skip
 * @param {object|false} [options.hitAreaOverlap]
 * @param {object|false} [options.focusVisible]
 * @param {object|false} [options.contrast]
 */
export async function expectDesignSystemContracts(page, options = {}) {
  const violations = [];

  if (options.touchTargets !== false) {
    violations.push(...(await checkTouchTargets(page, options.touchTargets ?? {})));
  }
  if (options.hitAreaOverlap !== false) {
    violations.push(...(await checkHitAreaOverlap(page, options.hitAreaOverlap ?? {})));
  }
  if (options.focusVisible !== false) {
    violations.push(...(await checkFocusVisible(page, options.focusVisible ?? {})));
  }
  if (options.contrast !== false) {
    violations.push(...(await checkContrast(page, options.contrast ?? {})));
  }

  if (violations.length) {
    const detail = violations
      .map((violation) => `  - ${violation.element}\n      ${violation.message}`)
      .join('\n');

    throw new Error(
      `${violations.length} design system contract violation(s). Run \`pnpm ds contracts\` for the full rules.\n\n${detail}`,
    );
  }

  return violations;
}
