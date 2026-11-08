import { expect, test } from '../fixtures';
import { DOCS_URL, docsRoutes, isReflowRoute, reflowTitle } from './routes';

/* WCAG 1.4.10 Reflow on the component pages, at 320 CSS px (#331).

   Two checks per page. The page must not scroll sideways. And the Copy button
   on the component header's import line must not sit on top of any of its
   text — the line used to run under it on every width.

   Takes no screenshot, so `docs-reflow` is a no-baseline project the same way
   `smoke` is (NO_BASELINE_PROJECTS in scripts/visual-shots.mjs).

   It lives in the visual suite because that is where CI has a browser: the
   quality job's image has none, and the browser suites under packages/ skip
   there. The title leads with the route and the shot separator, so a pull
   request's scoped run selects it with the same pattern that selects the
   page's own shots, and an added component — which widens the scope to every
   docs route — runs all of them. */

/* Pages known to overflow because the component itself is too wide, not the
   docs site: Pagination (421px), Stepper (421px) and Tabs (325px) at 320px.
   Fixing them is a packages/react change — #345.

   An exact list, so a fourth page that starts to overflow still fails. These
   pages are asserted to STILL overflow rather than skipped, and only that one
   assertion flips: once #345 fixes a component, its page fits, the run goes
   red, and the entry has to come out of this list. The Copy-button check stays
   strict on them. (`test.fail` would mark the whole test, so it would also
   have hidden a Copy-button regression on these three pages.) */
const KNOWN_OVERFLOW = new Set([
  '/components/pagination', // #345: collapse to fewer buttons
  '/components/stepper', // #345: vertical on narrow screens
  '/components/tabs', // #345: the tab list scrolls sideways
]);

const reflowRoutes = docsRoutes().filter(isReflowRoute);

/* A stale or misspelt entry would mark nothing and say nothing. */
for (const route of KNOWN_OVERFLOW) {
  if (!reflowRoutes.includes(route)) {
    throw new Error(`KNOWN_OVERFLOW names '${route}', which is not a component page. Remove it.`);
  }
}

/* The three functions below run in the page (`page.evaluate`), so each is
   self-contained: no closure over this module. */

/** The page's width, and the deepest elements past the viewport's right edge,
 *  so a failure names the thing to fix. Content inside a scroll container (a
 *  code block) can be wider than the viewport without widening the page, so it
 *  is not counted. */
function measureOverflow() {
  const viewport = window.innerWidth;
  const inScroller = (el: Element) => {
    for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
      if (getComputedStyle(up).overflowX !== 'visible') {
        return true;
      }
    }
    return false;
  };
  const wide = [...document.querySelectorAll('body *')].filter(
    (el) => el.getBoundingClientRect().right > viewport + 0.5 && !inScroller(el),
  );
  const leaves = wide.filter((el) => !wide.some((other) => other !== el && el.contains(other)));
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: viewport,
    culprits: leaves.slice(0, 5).map((el) => {
      const right = Math.round(el.getBoundingClientRect().right);
      const text = (el.textContent ?? '').trim().slice(0, 60);
      return `<${el.tagName.toLowerCase()} class="${el.getAttribute('class') ?? ''}"> ends at ${right}px: ${text}`;
    }),
  };
}

/** Whether a page with a component header is missing its import snippet, Copy
 *  button or <pre>. Without this, a renamed class would leave nothing to
 *  measure, and the Copy check would pass having checked nothing. */
function snippetMissing() {
  const header = document.querySelector('.component-header');
  const snippet = header?.querySelector('.code-block');
  return (
    Boolean(header) &&
    !(snippet?.querySelector('.code-block__copy') && snippet.querySelector('pre'))
  );
}

/** Import-line text that sits under the Copy button, with each label. The
 *  button reads "Copied" for two seconds after a click, and that label is the
 *  wider one. Restores the label it found. */
function textUnderCopyButton() {
  const snippet = document.querySelector('.component-header .code-block');
  const copy = snippet?.querySelector<HTMLElement>('.code-block__copy');
  const code = snippet?.querySelector('pre');
  if (!copy || !code) {
    return [];
  }

  const original = copy.textContent;
  const found: string[] = [];
  for (const label of ['Copy', 'Copied']) {
    copy.textContent = label;
    const button = copy.getBoundingClientRect();
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      if (!text) {
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const hit = [...range.getClientRects()].some(
        (box) =>
          box.right > button.left &&
          box.left < button.right &&
          box.bottom > button.top &&
          box.top < button.bottom,
      );
      if (hit) {
        found.push(`${label}: ${text}`);
      }
    }
  }
  copy.textContent = original;
  return found;
}

for (const route of reflowRoutes) {
  test(reflowTitle(route), async ({ page }) => {
    await page.goto(`${DOCS_URL}${route}`, { waitUntil: 'networkidle' });
    /* Widths depend on the web fonts, so measure the final layout. */
    await page.evaluate(() => document.fonts.ready);

    const { scrollWidth, innerWidth, culprits } = await page.evaluate(measureOverflow);
    if (KNOWN_OVERFLOW.has(route)) {
      expect(
        scrollWidth,
        `${route} fits at ${innerWidth}px now. #345 fixed it: remove it from KNOWN_OVERFLOW.`,
      ).toBeGreaterThan(innerWidth);
    } else {
      expect(
        scrollWidth,
        `${route} is ${scrollWidth}px wide at a ${innerWidth}px viewport. Widest content:\n${culprits.join('\n')}`,
      ).toBeLessThanOrEqual(innerWidth);
    }

    expect(
      await page.evaluate(snippetMissing),
      `${route} has a component header without its import snippet`,
    ).toBe(false);

    expect(
      await page.evaluate(textUnderCopyButton),
      `the Copy button covers import-line text on ${route}`,
    ).toEqual([]);
  });
}
