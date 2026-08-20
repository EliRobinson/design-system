/* Finds components whose rendering depends on a UA-stylesheet default that a
 * consumer's CSS reset removes.
 *
 * This is the shape of bug that reaches consumers and nothing here catches:
 * the default comes from the UA stylesheet, so the component is correct in
 * Storybook, correct in the docs app, and correct in jsdom (which does no
 * layout at all). It is wrong only with a reset loaded — the configuration
 * every consumer ships. Both known instances got out that way:
 *
 *   #78   `.ds-dialog` set no margin, so Tailwind Preflight's `* { margin: 0 }`
 *         beat the UA's `dialog:modal { margin: auto }` and every modal
 *         rendered in the top-left corner.
 *   #126  `.ds-input` sets no line-height, so Preflight's `font: inherit` on
 *         form controls replaced the UA's `normal` and every field grew ~5px.
 *
 * The method is deliberately geometric. Two cheaper approaches were tried
 * first and both were worse than useless:
 *
 *   - Pairing a component's source with its stylesheet and looking for a
 *     missing declaration cannot see across files. It misses #78 itself:
 *     <dialog> is rendered in one module and `.ds-dialog` is styled in
 *     another, so nothing ever pairs them.
 *   - Diffing computed properties reports mostly noise. A property can change
 *     on an element whose visible box is set by something else entirely — an
 *     <h3> losing its UA font-size matters not at all when the text inside it
 *     is a button that declares its own.
 *
 * A box that moves is the ground truth, and it does not care which file
 * declares what.
 */

/** Sub-pixel layout jitter, not a real move. */
const DEFAULT_TOLERANCE = 0.5;

/**
 * @typedef {object} PreflightFinding
 * @property {string} selector a readable locator for the element
 * @property {string} tag
 * @property {string} className
 * @property {string[]} changes e.g. ['h 44.0->49.1']
 */

/**
 * Measure every element under `root`, apply `resetCss`, measure again, and
 * report the ones whose box moved.
 *
 * Position is measured RELATIVE to the root. A reset restyles the surrounding
 * page too, so absolute positions shift for reasons that have nothing to do
 * with the component under test — reporting those would bury the real findings
 * in a page-wide offset.
 *
 * @param {import('playwright').Page} page a page with the component rendered
 * @param {object} options
 * @param {string} options.resetCss the reset to apply — pass the consumer's
 *   real one (`tailwindcss/preflight.css` for a Tailwind consumer) rather than
 *   an approximation, since the point is what that consumer actually ships
 * @param {string} [options.rootSelector] subtree to measure, default `body`
 * @param {number} [options.tolerance] px, default 0.5
 * @returns {Promise<PreflightFinding[]>}
 */
export async function findPreflightSensitiveElements(page, options) {
  const { resetCss, rootSelector = 'body', tolerance = DEFAULT_TOLERANCE } = options ?? {};

  if (typeof resetCss !== 'string' || !resetCss.trim()) {
    throw new TypeError(
      'findPreflightSensitiveElements needs the reset CSS to apply. Pass the ' +
        "consumer's real reset — for Tailwind, the contents of " +
        'tailwindcss/preflight.css.',
    );
  }

  const snapshot = () =>
    page.evaluate((selector) => {
      const root = document.querySelector(selector) ?? document.body;
      const base = root.getBoundingClientRect();
      return [...root.querySelectorAll('*')].map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className : '',
          id: element.id ?? '',
          w: rect.width,
          h: rect.height,
          dx: rect.x - base.x,
          dy: rect.y - base.y,
        };
      });
    }, rootSelector);

  const before = await snapshot();
  await page.addStyleTag({ content: resetCss });
  const after = await snapshot();

  /* A reset that adds or removes elements means the two snapshots describe
     different pages and cannot be compared index-wise. That is a broken
     fixture, not a finding. */
  if (before.length !== after.length) {
    throw new Error(
      `The reset changed the element count (${before.length} -> ${after.length}), so the ` +
        'two measurements are not comparable. Check that resetCss contains only style rules.',
    );
  }

  const findings = [];

  for (let i = 0; i < before.length; i++) {
    const a = before[i];
    const b = after[i];
    const changes = [];

    for (const [key, label] of [
      ['w', 'w'],
      ['h', 'h'],
      ['dx', 'dx'],
      ['dy', 'dy'],
    ]) {
      if (Math.abs(a[key] - b[key]) > tolerance) {
        changes.push(`${label} ${a[key].toFixed(1)}->${b[key].toFixed(1)}`);
      }
    }

    if (!changes.length) continue;

    const selector =
      (a.id && `#${a.id}`) ||
      (a.className && `${a.tag}.${a.className.trim().split(/\s+/).join('.')}`) ||
      a.tag;

    findings.push({ selector, tag: a.tag, className: a.className, changes });
  }

  return findings;
}
