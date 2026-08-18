// The half of contracts.json a linter cannot settle.
//
// `minimumTouchTarget`, `focusVisibleRequired` and `contrastLevel` are all
// claims about rendered geometry and computed colour, so the only honest way to
// check them is in a browser. These helpers take a Playwright `page` and return
// violations; drop them into an existing E2E suite rather than standing up a
// separate harness:
//
//   // e2e/design-system.spec.ts
//   import { expectDesignSystemContracts } from '@elirobinson/ai-patterns/testing/playwright'
//
//   test('home page meets the design system contracts', async ({ page }) => {
//     await page.goto('/')
//     await expectDesignSystemContracts(page)
//   })
//
// Playwright compiles a plain `.ts` spec to CommonJS, so that import resolves
// through the export map's `require` condition, which points back at this file
// and relies on Node's `require(esm)` — hence the package's `>=22.12.0` engines
// floor, and hence no top-level await below. On an older runtime, name the spec
// `.spec.mts` instead: Playwright treats it as ESM and the import is unchanged.
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
 *
 * Every class below names the element that *receives the click*. An exemption
 * written against an inner span silently matches nothing, which reads as a
 * clean sweep rather than as a broken rule — `.ds-rating__star` was that bug
 * for as long as this list existed: Rating puts the class on the glyph and the
 * control is `button.ds-rating__button`, so the exemption never fired. New
 * design-system affordances declare themselves with the data attribute instead
 * of being added here, which cannot drift the same way.
 */
export const DENSE_AFFORDANCE_SELECTOR = [
  '[data-touch-target="dense"]',
  '.ds-chip__remove',
  '.ds-search-field__clear',
  '.ds-rating__button',
  '.ds-date-picker__day',
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
 * A form control's hit area is not always the control. A `<label>` forwards its
 * clicks to the control it labels, so in the standard "small native input, real
 * text label" pairing the label *is* the target a finger goes for — measuring
 * only the 18x18 checkbox measures something nobody aims at. A control
 * therefore passes when either its own hit area or a single label that
 * activates it clears the minimum.
 *
 * It has to be a *single* surface, not the union of the two: an input and a
 * label separated by a gap do not add up to one 44x44 region a finger can hit,
 * and treating them as if they did would pass every checkbox ever written. So
 * an unlabelled 18x18 checkbox still fails, and so does one whose label is a
 * 20px-tall sliver of text — which is what makes this a measurement fix rather
 * than an exemption.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {string} [options.selector] which controls to measure
 * @param {string} [options.exempt] controls held to the dense scale instead
 * @param {number} [options.minimum] px, defaults to the contract's 44
 * @returns {Promise<Array<{ element: string, width: number, height: number, effectiveWidth: number, effectiveHeight: number, labelWidth?: number, labelHeight?: number, message: string }>>}
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

      const isRendered = (element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = getComputedStyle(element);
        return style.visibility !== 'hidden' && style.display !== 'none';
      };

      // Walk outward from a surface's centre until the browser stops routing
      // hits back to it. That is the hit area a finger actually gets, which is
      // what the contract is about — padding and bounded overlays both count.
      //
      // Only the surface itself or something inside it counts. An *ancestor*
      // answering the hit test means the point missed — and since <body>
      // contains every control, treating ancestors as hits would make every
      // target look infinitely large.
      const measure = (surface) => {
        const rect = surface.getBoundingClientRect();
        const centreX = rect.left + rect.width / 2;
        const centreY = rect.top + rect.height / 2;

        const hits = (x, y) => {
          const hit = document.elementFromPoint(x, y);
          return hit === surface || surface.contains(hit);
        };

        // A surface nothing routes to is not a sizing question, and the walk
        // below cannot tell the two apart: it starts at ±1px, so a control
        // covered by something else reaches 0 in all four directions and comes
        // back as "1x1". With a modal <dialog> open that is every control
        // behind it — Chromium attributes hits over the ::backdrop to the
        // dialog — so an untouched 186x44 button reported ~1x1 and advised
        // padding, which would have done nothing. `null` means "unmeasurable",
        // which the caller skips rather than reports.
        if (!hits(centreX, centreY)) return null;

        const reach = (dx, dy) => {
          let distance = 0;
          for (let step = 1; step <= minimum; step += 1) {
            if (!hits(centreX + dx * step, centreY + dy * step)) break;
            distance = step;
          }
          return distance;
        };

        return { width: reach(-1, 0) + reach(1, 0) + 1, height: reach(0, -1) + reach(0, 1) + 1 };
      };

      const meets = (area) => area.width >= minimum && area.height >= minimum;

      // `.labels` covers both `<label for>` and a wrapping `<label>`, and is
      // only defined on the elements that can actually be labelled — an <a> or
      // a [role="button"] div gets nothing, which is correct: no label
      // forwards a click to them.
      const labelsOf = (element) => (element.labels ? Array.from(element.labels) : []);

      const violations = [];

      for (const element of document.querySelectorAll(selector)) {
        if (exempt && element.closest(exempt)) continue;
        if (element.disabled) continue;
        if (!isRendered(element)) continue;

        const own = measure(element);
        if (!own || meets(own)) continue;

        // Too small on its own. If a label that activates it is big enough by
        // itself, that label is the surface being aimed at.
        const labelAreas = labelsOf(element).filter(isRendered).map(measure).filter(Boolean);
        if (labelAreas.some(meets)) continue;

        // Report the roomiest label considered, so the message says what was
        // measured rather than leaving the reader to guess why 18x18 was not
        // rescued by the label sitting next to it.
        const label = labelAreas.reduce(
          (best, area) =>
            !best || area.width * area.height > best.width * best.height ? area : best,
          null,
        );

        const rect = element.getBoundingClientRect();

        violations.push({
          element: describe(element),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          effectiveWidth: own.width,
          effectiveHeight: own.height,
          ...(label ? { labelWidth: label.width, labelHeight: label.height } : {}),
          message:
            `touch-target-primary: hit area is ~${own.width}x${own.height}, below ${minimum}x${minimum}` +
            (label ? `, and its label is only ~${label.width}x${label.height}` : '') +
            `. Expand it with padding or a bounded overlay — do not inflate the visible control` +
            (label ? `; giving the label the full row height is usually the fix` : '') +
            `. If this is a dense inline affordance, mark it data-touch-target="dense".`,
        });
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
 * Controls that refuse focus are skipped, not reported. Everything behind an
 * open modal `<dialog>` is inert, so `.focus()` does nothing and the before and
 * after snapshots match — which would otherwise read as a missing focus ring on
 * a control whose ring is fine.
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

      // Same guard as the programmatic branch: a control the browser refuses
      // to focus (inert behind an open modal) would otherwise read as one
      // whose focus ring does nothing.
      if (!(await control.evaluate((element) => document.activeElement === element))) continue;

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

        // Focus can be refused — a control behind an open modal <dialog> is
        // inert, so `.focus()` is a no-op and activeElement stays inside the
        // dialog. The snapshots then match for the trivial reason that the
        // element was never focused, and the check would report a missing
        // focus ring on a control that has one. Only judge what took focus.
        if (document.activeElement !== element) continue;

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
