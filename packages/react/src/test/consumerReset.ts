import { readFileSync } from 'node:fs';

import { afterAll, beforeAll } from 'vitest';

/** The `*` block every mainstream reset ships some version of. Tailwind v4's
 * preflight is the copy below; normalize-ish resets, sanitize.css and most
 * hand-rolled ones differ only in which properties they list. */
const UNIVERSAL_RESET = `
  *,
  ::after,
  ::before,
  ::backdrop,
  ::file-selector-button {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
  }
`;

/**
 * Mounts a consumer's universal reset, then real package stylesheets on top,
 * for the duration of the calling suite.
 *
 * Vitest renders with no stylesheets at all, so a component that silently
 * depends on the UA stylesheet looks correct in every jsdom test and breaks in
 * every consumer app that ships a reset — issue #103, where `.ds-dialog`
 * inherited its centring from the UA's `dialog { margin: auto }` and landed in
 * the top-left corner under Tailwind preflight. A universal `margin: 0` is an
 * *author* rule, and author styles beat the UA at any specificity, so the
 * reset is what makes that class of bug visible; without it in the fixture,
 * there is nothing to see.
 *
 * **The stylesheets are read off disk, not retyped here.** A copy of the rules
 * in the test would keep passing after the shipped file regressed, which is
 * the one thing this fixture exists to prevent. They are read with `fs` rather
 * than imported because Vitest's default `css: false` stubs a CSS import — and
 * `?raw` along with it — to an empty string, so an import would mount nothing
 * and assert nothing, silently.
 *
 * ## What this can and cannot prove
 *
 * **jsdom resolves the cascade by source order alone — it does not implement
 * specificity.** `.ds-dialog` loaded before `* { margin: 0 }` loses there,
 * though it would win in every real browser. So the reset is mounted *first*,
 * matching how a consumer actually loads one (Tailwind's preflight sits in
 * `@layer base`, beneath component CSS), and the fixture is calibrated to what
 * jsdom can model.
 *
 * The consequence is worth being precise about. This fixture proves the
 * component **declares the property itself instead of inheriting it from the
 * UA** — which is exactly the #103 regression, since a rule that declares
 * nothing loses to the reset in any order. It does *not* prove the component
 * would out-rank a reset on specificity; jsdom cannot answer that question at
 * all. A rule that needs to beat a reset of equal-or-higher specificity needs
 * a real browser, i.e. the Playwright suite in `tests/visual/`.
 *
 * Opt-in per suite rather than global, for the same reason as
 * `stubViewportLayout` (test/viewport.ts): every suite paying jsdom's cascade
 * cost for a guarantee only a handful of components need is a bad trade.
 *
 * Call at the top level of a `describe` block.
 *
 * @param stylesheets Paths of the stylesheets to mount, relative to `src/`.
 */
export function stubConsumerReset(...stylesheets: string[]) {
  const mounted: HTMLStyleElement[] = [];

  function mount(css: string) {
    const element = document.createElement('style');
    element.textContent = css;
    document.head.append(element);
    mounted.push(element);
    return element;
  }

  beforeAll(() => {
    mount(UNIVERSAL_RESET);

    const sourceRoot = `${import.meta.dirname}/..`;

    for (const stylesheet of stylesheets) {
      const element = mount(readFileSync(`${sourceRoot}/${stylesheet}`, 'utf8'));

      // jsdom drops any rule its CSS parser cannot handle, and drops it
      // quietly. A stylesheet that parsed to nothing would make every
      // assertion in the suite vacuously true, so the mount fails loudly
      // instead.
      if ((element.sheet?.cssRules.length ?? 0) === 0) {
        throw new Error(`${stylesheet} mounted no rules — jsdom could not parse it.`);
      }
    }
  });

  afterAll(() => {
    for (const element of mounted) {
      element.remove();
    }
    mounted.length = 0;
  });
}
