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
for (const route of docsRoutes().filter(isReflowRoute)) {
  test(reflowTitle(route), async ({ page }) => {
    await page.goto(`${DOCS_URL}${route}`, { waitUntil: 'networkidle' });

    const { scrollWidth, innerWidth, culprits, covered } = await page.evaluate(() => {
      const viewport = window.innerWidth;

      /* Content inside a scroll container (a code block) can be wider than
         the viewport without widening the page, so it is not a culprit. */
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
      /* The deepest ones, so a failure names the thing to fix. */
      const leaves = wide.filter((el) => !wide.some((other) => other !== el && el.contains(other)));

      const snippet = document.querySelector('.component-header .code-block');
      const button = snippet?.querySelector('.code-block__copy')?.getBoundingClientRect();
      const pre = snippet?.querySelector('pre');
      const coveredText: string[] = [];
      if (button && pre) {
        const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) {
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
            coveredText.push(node.textContent.trim());
          }
        }
      }

      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: viewport,
        culprits: leaves.slice(0, 5).map((el) => {
          const right = Math.round(el.getBoundingClientRect().right);
          const text = (el.textContent ?? '').trim().slice(0, 60);
          return `<${el.tagName.toLowerCase()} class="${el.getAttribute('class') ?? ''}"> ends at ${right}px: ${text}`;
        }),
        covered: coveredText,
      };
    });

    expect(
      scrollWidth,
      `${route} is ${scrollWidth}px wide at a ${innerWidth}px viewport. Widest content:\n${culprits.join('\n')}`,
    ).toBeLessThanOrEqual(innerWidth);

    expect(covered, `the Copy button covers import-line text on ${route}`).toEqual([]);
  });
}
