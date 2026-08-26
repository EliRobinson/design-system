/* The form-control `font: inherit` reset's cascade position, measured in a
 * browser. Sibling of link-cascade.test.mjs, and it exists for the same reason:
 * nothing you can read in tokens.css tells you whether a Tailwind utility beats
 * a rule in `@layer base`, because layer order is fixed by first declaration
 * across every stylesheet in the document. jsdom does not model layers at all.
 *
 * Issue #167. Native form controls do not inherit `font`, so the UA stylesheet
 * supplies Arial — and five shipped controls that set `font-size` and nothing
 * else typeset real words in it: .ds-search-field__input (the text the user
 * TYPES), .ds-pagination__item, .ds-segmented-control__item,
 * .ds-accordion__trigger and .ds-date-picker__day.
 *
 * Two decisions in that fix are only defensible as measurements, and this file
 * is where they are recorded:
 *
 *   the LAYER — an unlayered `button { font: inherit }` is (0,0,1), but
 *   unlayered beats every layer, so it silently ate a consumer's `font-mono`
 *   and their `text-2xl`. That is issue #112 in a new spelling.
 *
 *   the SHORTHAND — Tailwind v4's preflight already resets these elements with
 *   `font: inherit`. Matching it makes our rendering identical to what a
 *   Tailwind consumer already has; `font-family: inherit` alone would leave
 *   line-height at the UA's `normal` and diverge from them permanently.
 *
 * Skipped, loudly, when no browser is available — same contract as
 * link-cascade.test.mjs. The bare CI image has no Chromium and this must not be
 * what blocks an unrelated change.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));

/* Same 60s budget, and the same reason, as link-cascade.test.mjs. */
const BROWSER_BUDGET = 60_000;

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}

let browser;
let launchError;
if (chromium) {
  try {
    browser = await chromium.launch();
  } catch (error) {
    launchError = error;
  }
}

afterAll(async () => {
  await browser?.close();
}, BROWSER_BUDGET);

const describeBrowser = browser ? describe : describe.skip;
if (!browser) {
  console.warn(
    `Skipping form font cascade tests: ${chromium ? launchError?.message : 'playwright is not installed'}`,
  );
}

/* A synthetic origin, served from src/ by a route handler — tokens.css @imports
   its siblings relatively, so it has to be fetched from a URL that has a
   directory. Verbatim from link-cascade.test.mjs. */
const ORIGIN = 'https://tokens.test';

/* What `@import 'tailwindcss'` puts in front of tokens.css: the layer order
   statement, plus the two utilities that measure this rule. `font-mono` is the
   one `font-family: inherit` would have eaten; `text-2xl` is the one the
   shorthand would additionally have eaten had it been unlayered. */
const TAILWIND = `
  @layer theme, base, components, utilities;
  @layer utilities {
    .font-mono { font-family: ui-monospace, monospace; }
    .text-2xl { font-size: 1.5rem; }
  }
`;

/* Tailwind v4's preflight reset of these same elements, as it really ships:
   `font: inherit` in @layer base. Only the font declarations are reproduced —
   preflight's colour and background resets are not what this file measures.

   Inlined rather than imported, for link-cascade.test.mjs's reason: this is a
   test about a rule in THIS file and must not go red because a dependency
   changed. */
const PREFLIGHT = `
  @layer base {
    button, input, optgroup, select, textarea, ::file-selector-button {
      font: inherit;
      font-feature-settings: inherit;
      font-variation-settings: inherit;
      letter-spacing: inherit;
    }
  }
`;

/* The five audited rules as @elirobinson/react ships them: UNLAYERED, with
   `font-size` set and `font-family` never. Trimmed to the properties under
   test — the geometry that decides whether a line-height change reflows the
   control is kept, the colours are not. */
const COMPONENT = `
  .ds-search-field__input {
    width: 100%; min-height: 44px; font-size: var(--fs-sm);
  }
  .ds-pagination__item {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 44px; min-height: 44px; font-size: var(--fs-sm);
  }
  .ds-segmented-control__item {
    min-width: 44px; min-height: 44px; padding: 0 var(--space-3);
    font-size: var(--fs-sm);
  }
  .ds-accordion__trigger {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; min-height: 44px; padding: var(--space-3) 0;
    font-size: var(--fs-sm); font-weight: var(--fw-medium);
  }
  .ds-date-picker__day {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 32px; font-size: var(--fs-xs);
  }
`;

/* #search carries a `value`, not a placeholder: the issue's sharpest claim is
   about the text the user TYPES, and placeholder copy is painted by a different
   pseudo-element that would not have measured it. */
const BODY = `
  <input id="search" class="ds-search-field__input" value="Typed text 123">
  <button id="pagination" class="ds-pagination__item">12</button>
  <button id="segmented" class="ds-segmented-control__item">Weekly</button>
  <button id="accordion" class="ds-accordion__trigger">Shipping and returns</button>
  <button id="day" class="ds-date-picker__day">28</button>
  <textarea id="textarea">textarea text</textarea>
  <select id="select"><option>option text</option></select>
  <button id="utility-font" class="font-mono">consumer asked for mono</button>
  <button id="utility-size" class="text-2xl">consumer asked for 2xl</button>
`;

/** Every element measured, in the order the issue lists them. */
const AUDITED = ['search', 'pagination', 'segmented', 'accordion', 'day'];
const IDS = [...AUDITED, 'textarea', 'select', 'utility-font', 'utility-size'];

/**
 * A page holding the real tokens.css, with the consumer stylesheets stacked
 * around it in the given order.
 *
 * @param {string[]} before stylesheet sources emitted ahead of tokens.css
 */
async function consumer(...before) {
  const page = await browser.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><meta charset="utf-8">
          ${before.map((css) => `<style>${css}</style>`).join('\n')}
          <link rel="stylesheet" href="/tokens.css">
          <style>${COMPONENT}</style>
          ${BODY}`,
      });
    }

    const file = join(srcDir, name);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(file),
    });
  });

  await page.goto(`${ORIGIN}/index.html`);
  /* The faces are self-hosted and fetched over the same route handler. Reading
     a font-derived box before they land measures the fallback. */
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/**
 * Resolved font properties and box geometry per element, plus the page's own
 * resolution of --font-sans.
 *
 * Comparing a control's family against a family THE PAGE resolved, rather than
 * the literal 'Geist', is what keeps this from going red when the brand's face
 * changes — it asserts "the control took the body's face", never "the control
 * is Geist".
 */
const measure = (page, ids = IDS) =>
  page.evaluate((elementIds) => {
    const first = (family) => family.split(',')[0].trim().replace(/['"]/g, '');
    const bodyStyle = getComputedStyle(document.body);
    const result = {
      body: first(bodyStyle.fontFamily),
      bodyWeight: bodyStyle.fontWeight,
    };
    for (const id of elementIds) {
      const element = document.getElementById(id);
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      result[id] = {
        family: first(style.fontFamily),
        size: style.fontSize,
        weight: style.fontWeight,
        lineHeight: style.lineHeight,
        width: +box.width.toFixed(2),
        height: +box.height.toFixed(2),
      };
    }
    return result;
  }, ids);

describeBrowser('the five controls issue #167 audited', () => {
  it('typeset in the body face, not the UA stylesheet Arial', async () => {
    const page = await consumer(TAILWIND);
    const computed = await measure(page);
    await page.close();

    /* Guards the assertion below against passing on 'Arial' === 'Arial' if
       --font-sans ever failed to resolve. */
    expect(computed.body).not.toBe('Arial');

    for (const id of AUDITED) {
      expect(computed[id].family, `#${id}`).toBe(computed.body);
    }
  });

  it('keeps its own font-size — the reset changes the face, not the type ramp', async () => {
    /* The shorthand resets `font-size` too, so this is the property the choice
       of `font` over `font-family` puts at risk. It is safe because the
       component rules are unlayered and this one is not, and that is worth an
       assertion rather than an argument. */
    const page = await consumer(TAILWIND);
    const computed = await measure(page);
    await page.close();

    const ramp = await (async () => {
      const probe = await consumer(TAILWIND);
      const sizes = await probe.evaluate(() => {
        const read = (value) => {
          const span = document.createElement('span');
          span.style.fontSize = value;
          document.body.append(span);
          const size = getComputedStyle(span).fontSize;
          span.remove();
          return size;
        };
        return { sm: read('var(--fs-sm)'), xs: read('var(--fs-xs)') };
      });
      await probe.close();
      return sizes;
    })();

    expect(computed.search.size).toBe(ramp.sm);
    expect(computed.pagination.size).toBe(ramp.sm);
    expect(computed.segmented.size).toBe(ramp.sm);
    expect(computed.accordion.size).toBe(ramp.sm);
    expect(computed.day.size).toBe(ramp.xs);
  });

  it('keeps Accordion its own font-weight', async () => {
    /* The one audited control that states a weight. `font: inherit` resets
       font-weight as well, so an unlayered reset — or a component rule that
       lost the cascade — would flatten this to the body's 400. */
    const page = await consumer(TAILWIND);
    const computed = await measure(page);
    await page.close();

    expect(computed.accordion.weight).not.toBe(computed.bodyWeight);
    expect(computed.accordion.weight).toBe('500');
  });
});

describeBrowser('a Tailwind v4 consumer, wired the way the docs prescribe', () => {
  it('lets a font-* utility typeset a button — issue #112, respelled', async () => {
    /* The measurement that decided the layer. Unlayered, this rule is (0,0,1)
       and still beats `.font-mono` in @layer utilities, because unlayered wins
       over every layer regardless of specificity — so a consumer who asked, in
       markup, for a monospace button got Geist and had no way to override it
       from a stylesheet of their own. */
    const page = await consumer(TAILWIND);
    const computed = await measure(page);
    await page.close();

    expect(computed['utility-font'].family).toBe('ui-monospace');
    expect(computed['utility-font'].family).not.toBe(computed.body);
  });

  it('lets a text-* utility size a button', async () => {
    /* The second half, and the one that is specific to the SHORTHAND: an
       unlayered `font-family: inherit` leaves this alone, an unlayered
       `font: inherit` renders 16px and eats the consumer's 24px. Layered, the
       shorthand is safe. */
    const page = await consumer(TAILWIND);
    const computed = await measure(page);
    await page.close();

    expect(computed['utility-size'].size).toBe('24px');
  });
});

describeBrowser('the shorthand, against what Tailwind preflight already gives', () => {
  /* The argument for `font` over `font-family` is not that it is conventional.
     It is that preflight resets these same elements the same way, so a Tailwind
     consumer ALREADY renders this way while our own docs — which ship no
     preflight — mint baselines from the unreset rendering. The divergence
     exists today; this rule closes it rather than creating it.

     Asserted three ways: our rule alone, preflight alone, and both together
     must agree on every measured property of every element. */

  const identical = (a, b) => {
    for (const id of IDS) {
      expect(a[id], `#${id}`).toEqual(b[id]);
    }
  };

  it('renders exactly as preflight does, on every audited control', async () => {
    const ours = await consumer(TAILWIND);
    const oursComputed = await measure(ours);
    await ours.close();

    /* tokens.css is in this page too — there is no arrangement of this repo
       that removes it — so what this compares is "our rule" against "our rule
       plus preflight", i.e. that adding preflight on top changes nothing. */
    const withPreflight = await consumer(TAILWIND, PREFLIGHT);
    const withPreflightComputed = await measure(withPreflight);
    await withPreflight.close();

    identical(oursComputed, withPreflightComputed);
  });

  it('includes <textarea> and <select> deliberately', async () => {
    /* Both are outside the audited five and both are in preflight's selector
       list. Dropping them because no shipped component uses them yet would
       re-open the divergence on precisely those elements — a <textarea> in a
       consumer's Tailwind app renders the body face, and in ours would have
       kept the UA's monospace. */
    const page = await consumer(TAILWIND);
    const computed = await measure(page);
    await page.close();

    expect(computed.textarea.family).toBe(computed.body);
    expect(computed.select.family).toBe(computed.body);
  });
});

describeBrowser('a consumer with no cascade layers at all', () => {
  it('still gets the reset, because layered CSS is all there is to beat', async () => {
    /* Without Tailwind, `@layer base` is declared by tokens.css itself and is
       the lowest-priority layer in the document. The reset still has to apply —
       the five controls are the whole point of it. */
    const page = await consumer();
    const computed = await measure(page);
    await page.close();

    expect(computed.body).not.toBe('Arial');
    for (const id of AUDITED) {
      expect(computed[id].family, `#${id}`).toBe(computed.body);
    }
  });
});
