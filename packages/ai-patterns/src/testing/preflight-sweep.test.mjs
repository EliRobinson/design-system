/* The detector for the #78 class of bug: a component whose rendering depends on
 * a UA-stylesheet default that a consumer's CSS reset removes.
 *
 * Every case here renders a fixture in a real browser, because that is the only
 * place the bug exists. jsdom does no layout, and the docs app and Storybook
 * both render without a reset — which is exactly why #78 shipped and why the
 * form-control regression in #126 is still shipping.
 *
 * Skipped, loudly, when no browser is available — same posture as
 * playwright.test.mjs, whose bootstrap this mirrors.
 */

import { describe, expect, it, afterAll } from 'vitest';

import { findPreflightSensitiveElements } from './preflight-sweep.mjs';

const BROWSER_BUDGET = 20_000;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}

let browser;
if (chromium) {
  browser = await Promise.race([
    chromium.launch(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('chromium.launch() timed out')), BROWSER_BUDGET),
    ),
  ]).catch(() => null);
}

afterAll(async () => {
  await browser?.close();
});

const describeBrowser = browser ? describe : describe.skip;

/* The one Preflight rule that causes #78, plus the line-height inheritance
   that causes #126. Enough to be a real reset without pulling Tailwind in as a
   test dependency. */
const RESET = `
  *, ::before, ::after, ::backdrop { margin: 0; padding: 0; border: 0 solid; box-sizing: border-box; }
  button, input, select, textarea { font: inherit; }
`;

/* `body` is neutralised in every fixture. The reset zeroes the UA's 8px body
   margin, which widens the containing block and moves a CORRECTLY centred
   dialog — a page-chrome effect, not a component defect. Pinning body here is
   the fixture equivalent of pointing `rootSelector` at a story root in real
   use, which is what isolates the component from the page around it. */
const NEUTRAL_PAGE = 'body { margin: 0; padding: 0; }';

async function sweep(html, css) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(`<style>${NEUTRAL_PAGE}${css}</style>${html}`);
  const findings = await findPreflightSensitiveElements(page, { resetCss: RESET });
  await page.close();
  return findings;
}

describeBrowser('findPreflightSensitiveElements', () => {
  it('reports an element whose box moves when the reset is applied', async () => {
    /* A <dialog> leaning on the UA `dialog:modal { margin: auto }` — #78 itself,
       reduced to its smallest form. */
    const findings = await sweep(
      `<dialog id="d" open>panel</dialog>`,
      `#d { width: 200px; height: 100px; border: none; padding: 0; }`,
    );

    expect(findings.map((f) => f.selector)).toContain('#d');
  });

  it('reports nothing when the component restates what the reset removes', async () => {
    const findings = await sweep(
      `<dialog id="d" open>panel</dialog>`,
      `#d { width: 200px; height: 100px; border: none; padding: 0; margin: auto; }`,
    );

    expect(findings).toEqual([]);
  });

  /* The guard that keeps the two cases above honest. If the fixture stopped
     being hostile — a future browser dropping the UA default, or the reset
     failing to apply — the first case would report nothing and read as a pass
     for the wrong reason. */
  /* The guard that keeps the two cases above honest. If the fixture stopped
     being hostile — a future browser dropping the UA default, or the reset
     failing to apply — the first case would report nothing and read as a pass
     for the wrong reason.

     The wrapper's 1px padding is load-bearing: without it the paragraph's UA
     margin collapses through the (neutralised) body, its offset never changes,
     and this guard silently stops guarding. */
  const PARAGRAPH_FIXTURE = ['<div id="wrap"><p id="p">text</p></div>', '#wrap { padding: 1px; }'];

  it('proves the reset actually changes the page it is given', async () => {
    const findings = await sweep(...PARAGRAPH_FIXTURE);

    expect(findings.map((f) => f.selector)).toContain('#p');
  });

  it('names what moved, not just that something did', async () => {
    const findings = await sweep(...PARAGRAPH_FIXTURE);
    const finding = findings.find((f) => f.selector === '#p');

    expect(finding).toMatchObject({ selector: '#p', tag: 'p' });
    expect(finding.changes.join(' ')).toMatch(/^dy 17\.0->1\.0$/);
  });
});
