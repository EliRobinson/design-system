/* The form-control `font-family: inherit` reset's cascade position, measured in
 * a browser. Sibling of link-cascade.test.mjs, and it exists for the same
 * reason: nothing you can read in tokens.css tells you whether a Tailwind
 * utility beats a rule in `@layer base`, because layer order is fixed by first
 * declaration across every stylesheet in the document. jsdom does not model
 * layers at all.
 *
 * Issue #167. Native form controls do not inherit `font-family`, so the UA
 * stylesheet supplies Arial — and five shipped controls that set `font-size`
 * and nothing else typeset real words in it: .ds-search-field__input (the text
 * the user TYPES), .ds-pagination__item, .ds-segmented-control__item,
 * .ds-accordion__trigger and .ds-date-picker__day.
 *
 * Two decisions in that fix are only defensible as measurements, and this file
 * is where they are recorded:
 *
 *   the LAYER — an unlayered `button { font-family: inherit }` is (0,0,1), but
 *   unlayered beats every layer, so it silently ate a consumer's `font-mono`
 *   and rendered the button in Geist. That is issue #112 in a new spelling.
 *
 *   the LONGHAND — Tailwind v4's preflight resets these elements with the
 *   `font` shorthand, which also resets line-height and therefore moves every
 *   native control in the system, not just the five with the wrong face. The
 *   narrow fix was chosen; the resulting divergence from a preflight consumer
 *   is real, accepted, and measured in "the longhand, and the divergence from
 *   preflight it leaves open" below rather than left to memory.
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
/* Kept as ONE list here on purpose, unlike tokens.css's own split: this
   constant is preflight as Tailwind really ships it, and editing it to match
   our arrangement would stop it being the thing we are comparing against. */

/* Puts the controls back in the UA face, so "before this rule" can be measured
   in the same page rather than remembered as a number.

   Unlayered, which is what makes it work: tokens.css's reset lives in
   `@layer base`, and unlayered beats every layer regardless of specificity —
   the same fact this file measures elsewhere, used here as a tool. Arial is
   what the UA supplies for form controls in the engine these tests run in, so
   this reproduces the pre-#167 rendering rather than approximating it.

   `line-height: normal` as well as the family, and that is not belt-and-braces.
   Pinning only the family made the box comparison blind to the exact
   regression it exists to catch: under a `font: inherit` reset, BOTH the
   before and after pages would inherit the body's line-height — the override
   does not touch it — so the two heights moved together and the delta came out
   zero. Restoring both properties makes "before" mean the UA's rendering
   whatever the layered rule declares. */
const DEFEAT_RESET = `
  button, input, optgroup, select, textarea {
    font-family: Arial;
    line-height: normal;
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

describeBrowser('the longhand, and the divergence from preflight it leaves open', () => {
  /* This file used to assert the opposite. The rule was `font: inherit`, which
     matched preflight exactly and made our rendering identical to a Tailwind
     consumer's — and the price was the shorthand's line-height reset reaching
     every native control in the system, not just the five with the wrong face:
     .ds-input and .ds-select 44 -> 49.09px, .ds-textarea 64 -> 72.19px,
     .ds-accordion__trigger 44 -> 47.09px.

     The narrow fix was chosen instead. The face is the reported bug; the
     line-height is a layout change across most of the library that nobody
     asked for. So the divergence from a preflight consumer stays open, and
     this block exists to keep it MEASURED rather than forgotten — the failure
     mode of a knowingly-accepted difference is that nobody can later say what
     it was.

     What follows is therefore an inventory, not a complaint: the face agrees
     with preflight everywhere, and line-height is where the two part. */

  const withAndWithoutPreflight = async () => {
    const ours = await consumer(TAILWIND);
    const oursComputed = await measure(ours);
    await ours.close();

    /* tokens.css is in this page too — no arrangement of this repo removes it
       — so this is "our rule" against "our rule plus preflight", i.e. what a
       consumer following tailwind.css's own Usage section actually renders. */
    const withPreflight = await consumer(TAILWIND, PREFLIGHT);
    const withPreflightComputed = await measure(withPreflight);
    await withPreflight.close();

    return { ours: oursComputed, preflight: withPreflightComputed };
  };

  it('agrees with preflight on the typeface, everywhere', async () => {
    /* The half this rule does buy, and the whole of the reported bug. */
    const { ours, preflight } = await withAndWithoutPreflight();
    for (const id of IDS) {
      expect(ours[id].family, `#${id}`).toBe(preflight[id].family);
    }
  });

  it('differs from preflight on line-height, and only on line-height', async () => {
    /* The accepted cost, pinned. If a future edit closes this — by moving to
       the shorthand — this test is where it is supposed to fail, so that the
       layout change across .ds-input, .ds-select and .ds-textarea is a decision
       someone makes rather than a side effect they ship. */
    const { ours, preflight } = await withAndWithoutPreflight();

    for (const id of IDS) {
      /* The UA leaves these at `normal`; preflight inherits the body's. */
      expect(ours[id].lineHeight, `#${id} line-height`).toBe('normal');

      /* <select> is the exception, and it is the engine's, not ours: Chromium
         computes `normal` for a select's line-height whatever is declared, so
         this one element renders identically under both arrangements. Listed
         rather than skipped, because "select never diverges" is a fact worth
         keeping — if it ever starts to, that is a browser change and this is
         where it should surface. */
      if (id === 'select') {
        expect(preflight[id].lineHeight, '#select under preflight').toBe('normal');
        continue;
      }
      expect(preflight[id].lineHeight, `#${id} preflight line-height`).not.toBe('normal');
    }

    /* For a control that STATES its own font-size — which every audited one
       does, through an unlayered component rule — the divergence is exactly one
       property deep: same face, same size, same weight, different line-height. */
    for (const id of AUDITED) {
      expect(ours[id].family, `#${id} family`).toBe(preflight[id].family);
      expect(ours[id].size, `#${id} size`).toBe(preflight[id].size);
      expect(ours[id].weight, `#${id} weight`).toBe(preflight[id].weight);
    }

    /* For a control that states NOTHING, it is deeper, and this is the honest
       boundary of the claim above. The shorthand resets size and weight as well,
       so a bare <textarea> renders at the UA's 13.33px under our rule and at the
       inherited 16px under preflight.

       It does not reach the shipped components — .ds-textarea and .ds-select
       both build on .ds-input, which declares `font-size: var(--fs-sm)` — but it
       is exactly what a consumer's own unstyled <textarea> gets, so it belongs
       in the record rather than in a footnote. */
    expect(ours.textarea.size).not.toBe(preflight.textarea.size);
    expect(ours.textarea.family, 'the face still agrees').toBe(preflight.textarea.family);
  });

  it('moves only the two boxes a typeface change cannot avoid', async () => {
    /* The point of choosing the longhand. Measured on the REAL components, the
       only box that moves at all is .ds-segmented-control__item, 0.53px wider
       because Geist sets its label differently from Arial; every other audited
       control is unchanged, .ds-input and .ds-textarea included.

       READ THE BOUNDS, NOT THE EXACT NUMBERS. The rules below are this file's
       own trimmed copies — geometry only, no heading wrapper, no `::after` —
       and the accordion's height does not resolve identically here and in the
       shipped component: this fixture grows ~2px where the real trigger stays
       at 44. Rather than pin a number that is a property of the fixture, the
       assertions bound the movement, which is what actually distinguishes this
       rule from the one it replaced: under the `font` shorthand the same
       trigger went to 47.09px on the real component, and .ds-input, .ds-select
       and .ds-textarea moved 5-8px with it.

       Asserted against the SAME page with the reset defeated, so it measures
       this rule's own effect rather than a remembered number. */
    const withReset = await consumer(TAILWIND);
    const after = await measure(withReset);
    await withReset.close();

    const withoutReset = await consumer(TAILWIND, DEFEAT_RESET);
    const before = await measure(withoutReset);
    await withoutReset.close();

    /* The face really did change, or the comparison below proves nothing. */
    expect(before.search.family).not.toBe(after.search.family);

    /* The controls whose height is pinned — min-height with no vertical
       padding, or an explicit height — do not move at all, in either axis. */
    for (const id of ['search', 'pagination', 'day']) {
      expect(after[id].height, `#${id} height moved`).toBe(before[id].height);
      expect(after[id].width, `#${id} width moved`).toBe(before[id].width);
    }

    /* The segmented control reflows its label and keeps its height. */
    expect(after.segmented.height).toBe(before.segmented.height);
    expect(Math.abs(after.segmented.width - before.segmented.width)).toBeLessThan(2);

    /* The accordion is the only audited control whose height is content-derived
       rather than pinned — `min-height` plus vertical padding, so the line box
       decides — which is why it is the one the two arrangements separate. Any
       movement here is the face's own metrics; the shorthand's line-height
       reset is what pushes it past this bound. */
    const grew = after.accordion.height - before.accordion.height;
    expect(grew, 'the accordion grew like the shorthand, not the longhand').toBeLessThan(3);
    expect(grew, 'the accordion shrank, which no face change should do').toBeGreaterThanOrEqual(0);
    expect(after.accordion.width).toBe(before.accordion.width);
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

describeBrowser('why ::file-selector-button is a rule of its own', () => {
  /* Not a test of tokens.css — a test of the reasoning tokens.css encodes, in
     the same shape as link-cascade.test.mjs's "why the layer is named `base`".
     It has to be, because the risk is invisible in the only engine available
     here: Chromium parses ::file-selector-button, so a one-list arrangement
     measures identically to the split one RIGHT HERE and differs only on an
     engine that does not. What can be measured is the CSS rule that makes the
     split necessary — an unrecognised selector invalidates the ENTIRE rule it
     appears in, not just its own entry in the list.

     The structural half — that tokens.css really does keep the element list
     free of pseudo-elements — is asserted in @elirobinson/react's
     component-css.test.mjs, which is where the reset's shape is checked. */

  const resolve = async (reset) => {
    const page = await browser.newPage();
    await page.setContent(
      `<style>body { font-family: Georgia; } ${reset}</style><button id="b">x</button>`,
    );
    const family = await page.evaluate(() =>
      getComputedStyle(document.getElementById('b')).fontFamily.split(',')[0].replace(/['"]/g, ''),
    );
    await page.close();
    return family;
  };

  it('drops the whole rule when one selector in the list is unparsed', () => {
    return expect(
      resolve('button, input, ::totally-not-a-real-pseudo { font: inherit; }'),
    ).resolves.not.toBe('Georgia');
  });

  it('keeps the element rule when the pseudo-element is split off', () => {
    return expect(
      resolve('button, input { font: inherit; } ::totally-not-a-real-pseudo { font: inherit; }'),
    ).resolves.toBe('Georgia');
  });

  it('is a real risk only because the pseudo-element is the unknown one', () => {
    /* Chromium knows ::file-selector-button, so the one-list form works here —
       which is exactly why this cannot be caught by measuring our own CSS, and
       why the split is defence against an engine we do not have. */
    return expect(
      resolve('button, input, ::file-selector-button { font: inherit; }'),
    ).resolves.toBe('Georgia');
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
