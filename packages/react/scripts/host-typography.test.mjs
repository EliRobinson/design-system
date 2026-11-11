/* Overlay titles and lists keep their own styles inside a host `.prose`, and
 * the Combobox list opens below its input whatever layout the root is given.
 *
 * #367: host typography beat the component. The docs' `.prose h2` is (0,1,1)
 * and `.ds-dialog__title` was (0,1,0), so every Dialog and CommandPalette
 * title in a demo took the page's h2 size, margin, padding and rule, and the
 * palette's options showed bullets. Tailwind Typography and most typographic
 * resets do the same. This renders the real components, mounts each one twice
 * (bare, and inside a hostile `.prose` loaded AFTER the component sheets, the
 * worst order), and asserts the two compute the same.
 *
 * #368: `.ds-combobox__list` was `position: absolute` with no `top`, so it sat
 * at its static position. In a flex-column root that is the root's top, over
 * the input. This measures the list against the input in a real layout.
 *
 * Both need a real cascade and a real layout, which jsdom has neither of.
 * Skipped, loudly, when no browser is available: the same contract as
 * anchored-panel-width.test.mjs.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TOKENS_SRC_DIR } from '@elirobinson/tokens/token-stylesheets';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';

import { Combobox } from '../src/components/organisms/Combobox.tsx';
import { CommandPalette } from '../src/components/organisms/CommandPalette.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../src/components/organisms/Dialog.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../src/components/organisms/Sheet.tsx';

const COMPONENTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');
const SHEETS = {
  'Dialog.css': join(COMPONENTS, 'organisms', 'Dialog.css'),
  'Sheet.css': join(COMPONENTS, 'organisms', 'Sheet.css'),
  'CommandPalette.css': join(COMPONENTS, 'organisms', 'CommandPalette.css'),
  'Combobox.css': join(COMPONENTS, 'organisms', 'Combobox.css'),
  'SearchField.css': join(COMPONENTS, 'molecules', 'SearchField.css'),
};

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
    `Skipping host typography tests: ${
      chromium ? launchError?.message : 'playwright is not installed'
    }`,
  );
}

/* Two hosts. NOT_PROSE is Tailwind Typography's own escape hatch; the fixture
   honours it, as the plugin does. */
const NOT = ':not(:where([class~="not-prose"], [class~="not-prose"] *))';

const HOSTS = {
  /* The shape of apps/docs/src/app/site.css: plain descendant selectors at
     (0,1,1), which outrank a single class. */
  docs: `
    .prose h2 {
      font-size: 32px; font-weight: 800; line-height: 1.9; letter-spacing: 0.1em;
      margin: 40px 0 12px; padding-top: 16px; border-top: 1px solid red; color: red;
    }
    .prose p, .prose ul, .prose ol { line-height: 2.2; margin: 0 0 16px; }
    .prose li { margin-bottom: 4px; }
  `,
  /* The shape of @tailwindcss/typography: (0,1,0), and list markers on. */
  tailwind: `
    .prose :where(h2)${NOT} {
      font-size: 1.5em; font-weight: 700; line-height: 1.33; margin: 2em 0 1em; color: red;
    }
    .prose :where(p)${NOT} { margin-top: 1.25em; margin-bottom: 1.25em; }
    .prose :where(ul)${NOT} {
      list-style-type: disc; margin-top: 1.25em; margin-bottom: 1.25em; padding-inline-start: 1.625em;
    }
    .prose :where(li)${NOT} { margin-top: 0.5em; margin-bottom: 0.5em; padding-inline-start: 0.375em; }
  `,
};

/* Every property a host's heading, paragraph or list rule reaches for. */
const PROPERTIES = [
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'color',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-top-style',
  'list-style-type',
];

const noop = () => {};

/* Each case is real component markup plus the elements to compare. */
const CASES = {
  Dialog: {
    markup: renderToStaticMarkup(
      h(
        Dialog,
        { defaultOpen: true },
        h(
          DialogContent,
          null,
          h(DialogHeader, null, h(DialogTitle, null, 'Rename'), h(DialogDescription, null, 'Pick')),
        ),
      ),
    ),
    targets: ['.ds-dialog__title', '.ds-dialog__description'],
  },
  Sheet: {
    markup: renderToStaticMarkup(
      h(
        Sheet,
        { defaultOpen: true },
        h(
          SheetContent,
          null,
          h(SheetHeader, null, h(SheetTitle, null, 'Filters'), h(SheetDescription, null, 'Narrow')),
        ),
      ),
    ),
    targets: ['.ds-sheet__title', '.ds-sheet__description'],
  },
  CommandPalette: {
    markup: renderToStaticMarkup(
      h(CommandPalette, {
        open: true,
        onOpenChange: noop,
        commands: [
          { id: 'new', label: 'New file' },
          { id: 'theme', label: 'Toggle theme', group: 'View' },
        ],
      }),
    ),
    targets: [
      '.ds-dialog__title',
      '.ds-command-palette__list',
      '.ds-command-palette__list > li',
      '.ds-command-palette__group-list',
      '.ds-command-palette__group-list > li',
    ],
  },
  Combobox: {
    markup: renderToStaticMarkup(
      h(Combobox, {
        label: 'Fruit',
        options: [{ value: 'apple', label: 'Apple' }],
        value: null,
        onValueChange: noop,
      }),
    ),
    /* The open list is client state, so the server render has none. This is
       the markup Combobox renders when nothing matches: the one branch with a
       text element a host can reach. */
    open: '<div role="listbox" class="ds-combobox__list"><p class="ds-combobox__empty">No matches</p></div>',
    targets: ['.ds-combobox__list', '.ds-combobox__empty'],
  },
};

const ORIGIN = 'https://host-typography.test';

/** Serve the tokens, the component sheets and one page, then run `probe`. */
async function inPage({ body, host = '' }, probe, arg) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await context.newPage();

  await page.route(`${ORIGIN}/**`, async (route) => {
    const name = new URL(route.request().url()).pathname.slice(1);

    if (name === 'index.html') {
      const links = Object.keys(SHEETS)
        .map((sheet) => `<link rel="stylesheet" href="/${sheet}">`)
        .join('');
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <link rel="stylesheet" href="/tokens.css">${links}
          <style>${host}</style>
          </head><body>${body}</body></html>`,
      });
    }

    if (SHEETS[name]) {
      return route.fulfill({ contentType: 'text/css', body: readFileSync(SHEETS[name]) });
    }

    const file = join(TOKENS_SRC_DIR, name);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      contentType: extname(name) === '.css' ? 'text/css' : 'font/woff2',
      body: readFileSync(file),
    });
  });

  await page.goto(`${ORIGIN}/index.html`);
  const result = await page.evaluate(probe, arg);
  await context.close();
  return result;
}

/** Computed PROPERTIES for each target, in a bare root and in a `.prose` root. */
function readStyles({ targets, properties, open }) {
  const read = (root) => {
    if (open) root.querySelector('.ds-combobox')?.insertAdjacentHTML('beforeend', open);
    return Object.fromEntries(
      targets.map((selector) => {
        const element = root.querySelector(selector);
        if (!element) return [selector, null];
        const style = getComputedStyle(element);
        return [
          selector,
          Object.fromEntries(properties.map((p) => [p, style.getPropertyValue(p)])),
        ];
      }),
    );
  };
  return {
    bare: read(document.getElementById('bare')),
    prose: read(document.getElementById('prose')),
  };
}

function twoRoots(markup) {
  return `<div id="bare">${markup}</div><div id="prose" class="prose">${markup}</div>`;
}

describeBrowser('components keep their own type and list styles inside .prose (#367)', () => {
  for (const [hostName, host] of Object.entries(HOSTS)) {
    /* The positive control: a plain h2 and ul really are restyled by this host,
       so a pass below is the component winning, not the fixture missing. */
    it(`${hostName}: the host fixture restyles a plain h2 and ul`, async () => {
      const { bare, prose } = await inPage(
        { body: twoRoots('<h2>Plain</h2><ul><li>Plain</li></ul>'), host },
        readStyles,
        { targets: ['h2', 'ul'], properties: PROPERTIES },
      );
      expect(prose.h2).not.toEqual(bare.h2);
      expect(prose.ul).not.toEqual(bare.ul);
    });

    for (const [name, { markup, targets, open }] of Object.entries(CASES)) {
      it(`${hostName}: ${name} computes the same inside .prose`, async () => {
        const { bare, prose } = await inPage({ body: twoRoots(markup), host }, readStyles, {
          targets,
          properties: PROPERTIES,
          open,
        });
        for (const selector of targets) {
          expect(bare[selector], `${selector} rendered`).not.toBeNull();
          expect(prose[selector], `${name} ${selector}`).toEqual(bare[selector]);
        }
      });
    }
  }

  it('lists carry no markers, bare or inside .prose', async () => {
    const { bare, prose } = await inPage(
      { body: twoRoots(CASES.CommandPalette.markup), host: HOSTS.tailwind },
      readStyles,
      { targets: CASES.CommandPalette.targets.slice(1), properties: ['list-style-type'] },
    );
    for (const styles of [bare, prose]) {
      for (const value of Object.values(styles)) expect(value['list-style-type']).toBe('none');
    }
  });
});

/** Where the open list sits against the input, in the given root layout. */
function measureList({ open, rootStyle }) {
  const root = document.querySelector('.ds-combobox');
  root.setAttribute('style', rootStyle);
  root.insertAdjacentHTML('beforeend', open);
  const input = root.querySelector('.ds-search-field').getBoundingClientRect();
  const list = root.querySelector('.ds-combobox__list').getBoundingClientRect();
  return {
    inputBottom: input.bottom,
    inputLeft: input.left,
    inputRight: input.right,
    listTop: list.top,
    listLeft: list.left,
    listRight: list.right,
  };
}

describeBrowser('the Combobox list opens below its input (#368)', () => {
  const layouts = {
    block: 'display: block',
    'flex column': 'display: flex; flex-direction: column',
    'flex column, centred': 'display: flex; flex-direction: column; justify-content: center',
    'flex row': 'display: flex; flex-direction: row; align-items: center',
  };

  for (const [layout, rootStyle] of Object.entries(layouts)) {
    it(`${layout} root: the list top is at or below the input bottom`, async () => {
      const box = await inPage({ body: CASES.Combobox.markup }, measureList, {
        open: CASES.Combobox.open,
        rootStyle,
      });
      expect(box.listTop).toBeGreaterThanOrEqual(box.inputBottom);
      expect(box.listLeft).toBeCloseTo(box.inputLeft, 0);
      expect(box.listRight).toBeCloseTo(box.inputRight, 0);
    });
  }
});
