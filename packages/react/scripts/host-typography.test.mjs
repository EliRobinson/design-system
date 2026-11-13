/* Component titles, paragraphs and lists keep their own styles inside a host
 * `.prose`, and the Combobox list opens below its input whatever layout the
 * root is given.
 *
 * #367: host typography beat the component. The docs' `.prose h2` is (0,1,1)
 * and `.ds-dialog__title` was (0,1,0), so every Dialog and CommandPalette
 * title in a demo took the page's h2 size, margin, padding and rule, and the
 * palette's options showed bullets. Tailwind Typography and most typographic
 * resets do the same. This renders the real components, mounts each one twice
 * (bare, and inside a hostile `.prose` loaded AFTER the component sheets, the
 * worst order), and asserts the two compute the same.
 *
 * #383: the same leak in every other component that renders a heading,
 * paragraph or list (Card, EmptyState, DecisionCard, StubCard, Pagination,
 * Breadcrumb). Alert and Toast render their title and description as `div`s,
 * which no host element rule reaches; they are cases so a later move to a
 * heading or paragraph keeps the reset.
 *
 * #414: Stepper, NavigationMenu and Accordion, which #383 missed.
 *
 * #423: links and tables, which no host here styled until then. Tailwind
 * Typography's `a` rule underlines, recolours and bolds a link at (0,1,0),
 * the same as `.ds-breadcrumb__link`, and wins on order. Its table rules add
 * margins, a line-height, row rules and cell alignment.
 *
 * #426: the hover state of those links. A host `.prose a:hover` is (0,2,1)
 * and outranks a link's own `:hover` at (0,2,0), so it recoloured and
 * underlined a hovered link. The hover cases below read a hovered link.
 *
 * #368: `.ds-combobox__list` was `position: absolute` with no `top`, so it sat
 * at its static position. In a flex-column root that is the root's top, over
 * the input. This measures the list against the input in a real layout.
 *
 * Both need a real cascade and a real layout, which jsdom has neither of.
 * Skipped, loudly, when no browser is available: the same contract as
 * anchored-panel-width.test.mjs.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Alert } from '../src/components/molecules/Alert.tsx';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '../src/components/molecules/Breadcrumb.tsx';
import { Card, CardDescription, CardHeader, CardTitle } from '../src/components/molecules/Card.tsx';
import { DecisionCard } from '../src/components/molecules/DecisionCard.tsx';
import { EmptyState } from '../src/components/molecules/EmptyState.tsx';
import { Pagination } from '../src/components/molecules/Pagination.tsx';
import { RuleLink } from '../src/components/molecules/RuleLink.tsx';
import { Stepper } from '../src/components/molecules/Stepper.tsx';
import { StubCard } from '../src/components/molecules/StubCard.tsx';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../src/components/organisms/Accordion.tsx';
import { Combobox } from '../src/components/organisms/Combobox.tsx';
import { CommandPalette } from '../src/components/organisms/CommandPalette.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../src/components/organisms/Dialog.tsx';
import { NavigationMenu } from '../src/components/organisms/NavigationMenu.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../src/components/organisms/Sheet.tsx';
import { Table } from '../src/components/organisms/Table.tsx';
import { Toast, ToastDescription, ToastTitle } from '../src/components/organisms/Toast.tsx';
import { VirtualTable } from '../src/components/organisms/VirtualTable.tsx';

import { bootBrowser, inPage } from './browser.test-helper.mjs';

const COMPONENTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');
/* The sheets every case needs, by tier. */
const SHEET_NAMES = {
  organisms: [
    'Dialog',
    'Sheet',
    'CommandPalette',
    'Combobox',
    'Toast',
    'NavigationMenu',
    'Accordion',
    'table/core',
    'Table',
    'VirtualTable',
  ],
  molecules: [
    'SearchField',
    'Card',
    'EmptyState',
    'DecisionCard',
    'VerdictBadge',
    'StubCard',
    'Alert',
    'Pagination',
    'Breadcrumb',
    'Stepper',
    'RuleLink',
  ],
};
const SHEETS = Object.fromEntries(
  Object.entries(SHEET_NAMES).flatMap(([tier, names]) =>
    names.map((name) => [`${name}.css`, join(COMPONENTS, tier, `${name}.css`)]),
  ),
);
const VIEWPORT = { width: 1024, height: 768 };

const { browser, describeBrowser } = await bootBrowser('host typography');

/** One page: the component sheets, then `host` (loaded last, the worst order).
    `act` runs before `probe`, as a hover does. */
function load({ body, host = '', act }, probe, arg) {
  return inPage(
    browser,
    { sheets: SHEETS, head: `<style>${host}</style>`, body, context: { viewport: VIEWPORT }, act },
    probe,
    arg,
  );
}

/* Two hosts. NOT_PROSE is Tailwind Typography's own escape hatch; the fixture
   honours it, as the plugin does. */
const NOT = ':not(:where([class~="not-prose"], [class~="not-prose"] *))';

const HOSTS = {
  /* The specificity of apps/docs/src/app/site.css: descendant selectors at
     (0,1,1), which outrank a single class. Kept hostile and apart from the
     real file, so it stays a worst case whatever the docs do. */
  docs: `
    .prose h2, .prose h3 {
      font-size: 32px; font-weight: 800; line-height: 1.9; letter-spacing: 0.1em;
      margin: 40px 0 12px; padding-top: 16px; border-top: 1px solid red; color: red;
      font-family: Georgia, serif;
    }
    .prose p, .prose ul, .prose ol { line-height: 2.2; margin: 0 0 16px; }
    .prose li { margin-bottom: 4px; line-height: 1.75; }
    .prose dl { margin: 0 0 16px; }
    .prose dt { font-weight: 800; margin-top: 12px; }
    .prose dd { margin: 0 0 8px 24px; }
    .prose a {
      color: red; font-weight: 800; text-decoration: underline; border-bottom: 3px dotted red;
      padding: 0 4px; margin: 0 2px; font-size: 18px; letter-spacing: 0.1em;
      border-top: 2px solid red; box-shadow: inset 0 -2px 0 red;
    }
    .prose a:hover { color: blue; text-decoration: underline wavy; }
    .prose table { margin: 32px 0; line-height: 2.2; font-size: 20px; }
    .prose th, .prose td {
      padding: 12px; border-bottom: 3px solid red; vertical-align: top; font-weight: 800;
      font-size: 18px; line-height: 2; text-align: right; border: 1px solid red;
    }
    .prose tr { background-color: red; }
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
    .prose :where(ol)${NOT} {
      list-style-type: decimal; margin-top: 1.25em; margin-bottom: 1.25em; padding-inline-start: 1.625em;
    }
    .prose :where(li)${NOT} { margin-top: 0.5em; margin-bottom: 0.5em; padding-inline-start: 0.375em; }
    .prose :where(h3)${NOT} {
      font-size: 1.25em; font-weight: 600; line-height: 1.6; margin-top: 1.6em; margin-bottom: 0.6em; color: red;
    }
    .prose :where(dl)${NOT} { margin-top: 1.25em; margin-bottom: 1.25em; }
    .prose :where(dt)${NOT} { font-weight: 600; margin-top: 1.25em; color: red; }
    .prose :where(dd)${NOT} { margin-top: 0.5em; padding-inline-start: 1.625em; }
    .prose :where(a)${NOT} { color: red; text-decoration: underline; font-weight: 500; }
    .prose :where(table)${NOT} {
      width: 100%; table-layout: auto; margin-top: 2em; margin-bottom: 2em;
      font-size: 0.875em; line-height: 1.71;
    }
    .prose :where(thead)${NOT} { border-bottom: 1px solid red; }
    .prose :where(thead th)${NOT} {
      color: red; font-weight: 600; vertical-align: bottom;
      padding-inline-end: 0.57em; padding-bottom: 0.57em; padding-inline-start: 0.57em;
    }
    .prose :where(tbody tr)${NOT} { border-bottom: 1px solid red; }
    .prose :where(tbody td)${NOT} { vertical-align: baseline; }
    .prose :where(tbody td, tfoot td)${NOT} {
      padding-top: 0.57em; padding-inline-end: 0.57em; padding-bottom: 0.57em; padding-inline-start: 0.57em;
    }
  `,
};

/* Every property a host's heading, paragraph, list, link or table rule
   reaches for. */
const PROPERTIES = [
  'font-family',
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
  'border-bottom-width',
  'border-bottom-style',
  'border-left-width',
  'border-right-width',
  'background-color',
  'box-shadow',
  'list-style-type',
  'text-decoration-line',
  'vertical-align',
  'text-align',
];

const noop = () => {};

const PALETTE_LISTS = [
  '.ds-command-palette__list',
  '.ds-command-palette__list > li',
  '.ds-command-palette__group-list',
  '.ds-command-palette__group-list > li',
];

/* The open list is client state, so a server render has none. This is the
   list Combobox.tsx renders when nothing matches (the `filtered.length === 0`
   branch): the one branch with a text element a host can reach. It is
   spliced into the server-rendered root, where the component mounts it. */
const COMBOBOX_EMPTY_LIST =
  '<div role="listbox" aria-label="Fruit options" class="ds-combobox__list">' +
  '<p class="ds-combobox__empty">No matches</p></div>';

const COMBOBOX_OPEN = renderToStaticMarkup(
  h(Combobox, {
    label: 'Fruit',
    options: [{ value: 'apple', label: 'Apple' }],
    value: null,
    onValueChange: noop,
  }),
).replace(/<\/div>$/, `${COMBOBOX_EMPTY_LIST}</div>`);

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
    targets: ['.ds-dialog__title', ...PALETTE_LISTS],
  },
  Combobox: {
    markup: COMBOBOX_OPEN,
    targets: ['.ds-combobox__list', '.ds-combobox__empty'],
  },
  /* #383: the same reset, for every other component that renders a heading,
     paragraph or list. */
  Card: {
    markup: renderToStaticMarkup(
      h(
        Card,
        null,
        h(CardHeader, null, h(CardTitle, null, 'Plan'), h(CardDescription, null, 'Monthly')),
      ),
    ),
    targets: ['.ds-card__title', '.ds-card__description'],
  },
  EmptyState: {
    markup: renderToStaticMarkup(
      h(EmptyState, { title: 'No results', description: 'Try another search' }),
    ),
    targets: ['.ds-empty-state__title', '.ds-empty-state__description'],
  },
  DecisionCard: {
    markup: renderToStaticMarkup(
      h(DecisionCard, {
        verdict: 'go',
        verdictLabel: 'Go',
        subject: 'Lease',
        headline: 'Sign the lease',
        figures: [{ id: 'rent', label: 'Rent', value: '$1,200' }],
        total: { label: 'Total', value: '$14,400' },
        contrast: { label: 'Last year', value: '$13,900' },
        caveat: 'Rent rises in March.',
        closing: 'Decide by Friday.',
      }),
    ),
    targets: [
      '.ds-decision__subject',
      '.ds-decision__headline',
      '.ds-decision__figures',
      '.ds-decision__figure-label',
      '.ds-decision__figure-value',
      '.ds-decision__total',
      '.ds-decision__contrast',
      '.ds-decision__caveat',
      '.ds-decision__closing',
    ],
  },
  /* The coded headline and the prose figure layout: modifiers that restyle
     reset elements. */
  'DecisionCard, coded': {
    markup: renderToStaticMarkup(
      h(DecisionCard, {
        verdict: 'hold',
        verdictLabel: 'Hold',
        code: 'D-12',
        headline: 'Wait a week',
        figureLayout: 'prose',
        figures: [{ id: 'why', label: 'Why', value: 'Prices drop after the sale.' }],
      }),
    ),
    targets: [
      '.ds-decision__headline',
      '.ds-decision__code',
      '.ds-decision__headline-text',
      '.ds-decision__figures',
      '.ds-decision__figure-label',
      '.ds-decision__figure-value',
    ],
  },
  StubCard: {
    markup: renderToStaticMarkup(
      h(StubCard, {
        title: 'Flight',
        items: [{ label: 'Seat', value: '14C' }],
        footnote: 'Boarding closes early.',
        stubLabel: 'Gate',
        stubValue: 'B12',
        stubCaption: 'Terminal 2',
      }),
    ),
    targets: [
      '.ds-stub__title',
      '.ds-stub__items',
      '.ds-stub__label',
      '.ds-stub__value',
      '.ds-stub__footnote',
      '.ds-stub__stub-label',
      '.ds-stub__stub-value',
      '.ds-stub__stub-caption',
    ],
  },
  Alert: {
    markup: renderToStaticMarkup(h(Alert, { title: 'Saved' }, 'Your changes are live.')),
    targets: ['.ds-alert__title', '.ds-alert__description'],
  },
  Toast: {
    markup: renderToStaticMarkup(
      h(Toast, null, h(ToastTitle, null, 'Copied'), h(ToastDescription, null, 'Link copied')),
    ),
    targets: ['.ds-toast__title', '.ds-toast__description'],
  },
  Pagination: {
    markup: renderToStaticMarkup(h(Pagination, { page: 2, pageCount: 9, onPageChange: noop })),
    targets: ['.ds-pagination__list', '.ds-pagination__list > li', '.ds-pagination__gap'],
  },
  Breadcrumb: {
    markup: renderToStaticMarkup(
      h(
        Breadcrumb,
        null,
        h(
          BreadcrumbList,
          null,
          h(BreadcrumbItem, null, h(BreadcrumbLink, { href: '/' }, 'Home')),
          h(BreadcrumbSeparator, null),
          h(BreadcrumbItem, null, h(BreadcrumbLink, { current: true }, 'Docs')),
        ),
      ),
    ),
    targets: [
      '.ds-breadcrumb__list',
      '.ds-breadcrumb__item',
      'a.ds-breadcrumb__link',
      '.ds-breadcrumb__link--current',
    ],
  },
  /* #414: the three the #383 review gate found. Stepper's root is its own
     `ol`; Accordion's heading is the default `headingLevel`, an h3. */
  Stepper: {
    markup: renderToStaticMarkup(
      h(Stepper, { steps: [{ label: 'Cart' }, { label: 'Pay' }], activeStep: 1 }),
    ),
    targets: ['.ds-stepper', '.ds-stepper__step', '.ds-stepper__label'],
  },
  NavigationMenu: {
    markup: renderToStaticMarkup(
      h(NavigationMenu, {
        currentPath: '/tokens',
        items: [
          { label: 'Foundations', items: [{ label: 'Tokens', href: '/tokens' }] },
          { label: 'Home', href: '/' },
        ],
      }),
    ),
    targets: [
      '.ds-navigation-menu__list',
      '.ds-navigation-menu__list > li',
      '.ds-navigation-menu__label',
      '.ds-navigation-menu__list .ds-navigation-menu__list',
      '.ds-navigation-menu__link--active',
      '.ds-navigation-menu__link:not(.ds-navigation-menu__link--active)',
    ],
  },
  /* #423: links and tables. RuleLink's root is its own `a`. Table renders a
     real table; VirtualTable renders an ARIA grid of `div`s, which no host
     element rule reaches, and is a case so a move to a real table keeps the
     reset. */
  RuleLink: {
    markup: renderToStaticMarkup(h(RuleLink, { href: '/rules' }, 'Read the rules')),
    targets: ['.ds-rule-link'],
  },
  Table: {
    markup: renderToStaticMarkup(
      h(Table, {
        data: [{ name: 'Ada', role: 'Engineer' }],
        columns: [
          { accessorKey: 'name', header: 'Name' },
          { accessorKey: 'role', header: 'Role' },
        ],
      }),
    ),
    targets: ['.ds-table', '.ds-table thead', '.ds-table th', '.ds-table tbody tr', '.ds-table td'],
  },
  VirtualTable: {
    markup: renderToStaticMarkup(
      h(VirtualTable, {
        data: [{ name: 'Ada' }],
        columns: [{ accessorKey: 'name', header: 'Name' }],
      }),
    ),
    targets: ['.ds-table--virtual', '.ds-table__vcell--head'],
  },
  Accordion: {
    markup: renderToStaticMarkup(
      h(
        Accordion,
        { defaultValue: 'a' },
        h(
          AccordionItem,
          { value: 'a' },
          h(AccordionTrigger, null, 'Shipping'),
          h(AccordionContent, null, 'Two days'),
        ),
      ),
    ),
    targets: ['.ds-accordion__heading', '.ds-accordion__trigger', '.ds-accordion__content'],
  },
};

/* #426: the links each case renders, read again under the pointer. */
const HOVER_CASES = {
  Breadcrumb: ['a.ds-breadcrumb__link', '.ds-breadcrumb__link--current'],
  RuleLink: ['.ds-rule-link'],
  NavigationMenu: [
    '.ds-navigation-menu__link--active',
    '.ds-navigation-menu__link:not(.ds-navigation-menu__link--active)',
  ],
};

/* #414, #423: components were missed because joining CASES was a rule in a
   doc. Every component file that renders a heading, paragraph, list, link or
   table (or picks a heading from an `'h1'`-`'h6'` tag map or `headingLevel`)
   must name a case, so the next one fails here instead. Runs without a
   browser. */
const TEXT_ELEMENT = /<(h[1-6]|p|ul|ol|li|dl|a|table)[\s>]|['"]h[1-6]['"]|headingLevel/;

/* Comments stripped, as tier-boundary.test.mjs does, so a file that only
   mentions an element in prose neither needs a case nor counts as one. */
const code = (file) =>
  readFileSync(join(COMPONENTS, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

function textBearingComponents() {
  return readdirSync(COMPONENTS, { recursive: true })
    .filter((file) => /\.tsx$/.test(file) && !/\.(test|stories)\.tsx$/.test(file))
    .filter((file) => TEXT_ELEMENT.test(code(file)))
    .map((file) => basename(file, '.tsx'))
    .sort();
}

describe('every text-bearing component is a host-typography case (#414)', () => {
  it('finds the components it sweeps', () => {
    expect(textBearingComponents()).toEqual(
      expect.arrayContaining(['Stepper', 'RuleLink', 'Table']),
    );
  });

  it('each one has a CASES entry', () => {
    const names = Object.keys(CASES).map((key) => key.split(',')[0]);
    const missing = textBearingComponents().filter((name) => !names.includes(name));
    expect(missing, 'add these to CASES').toEqual([]);
  });
});

/** Computed PROPERTIES for each target, in a bare root and in a `.prose` root. */
function readStyles({ targets, properties }) {
  const read = (root) =>
    Object.fromEntries(
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
  return {
    bare: read(document.getElementById('bare')),
    prose: read(document.getElementById('prose')),
  };
}

/* `apart` holds the roots 64px apart. RuleLink and Breadcrumb grow their
   hit areas with a negative margin, so packed together one root's link sits
   under the other's and takes the pointer. */
function twoRoots(markup, { apart = false } = {}) {
  const gap = apart ? ' style="margin: 64px 0"' : '';
  return `<div id="bare"${gap}>${markup}</div><div id="prose" class="prose"${gap}>${markup}</div>`;
}

/** An `act` that puts the pointer on `selector`, and fails fast if it cannot. */
const hover = (selector) => (page) => page.hover(selector, { timeout: 2000 });

describeBrowser('components keep their own type and list styles inside .prose (#367, #383)', () => {
  for (const [hostName, host] of Object.entries(HOSTS)) {
    /* The positive control: a plain h2 and ul really are restyled by this host,
       so a pass below is the component winning, not the fixture missing. */
    it(`${hostName}: the host fixture restyles a plain h2, ul, a, table and td`, async () => {
      const plain =
        '<h2>Plain</h2><ul><li>Plain</li></ul><a href="/">Plain</a>' +
        '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>';
      const targets = ['h2', 'ul', 'a', 'table', 'th', 'td'];
      const { bare, prose } = await load({ body: twoRoots(plain), host }, readStyles, {
        targets,
        properties: PROPERTIES,
      });
      for (const selector of targets) expect(prose[selector], selector).not.toEqual(bare[selector]);
    });

    for (const [name, { markup, targets }] of Object.entries(CASES)) {
      it(`${hostName}: ${name} computes the same inside .prose`, async () => {
        const { bare, prose } = await load({ body: twoRoots(markup), host }, readStyles, {
          targets,
          properties: PROPERTIES,
        });
        for (const selector of targets) {
          expect(bare[selector], `${selector} rendered`).not.toBeNull();
          expect(prose[selector], `${name} ${selector}`).toEqual(bare[selector]);
        }
      });
    }
  }

  /* #426: the links again, hovered. Each root is read in its own page, with
     the pointer on that root's link, since only one element is hovered at a
     time. */
  it('docs: the host fixture restyles a plain hovered a', async () => {
    const read = (root) =>
      load(
        {
          body: twoRoots('<a href="/">Plain</a>'),
          host: HOSTS.docs,
          act: hover(`#${root} a`),
        },
        readStyles,
        { targets: ['a'], properties: PROPERTIES },
      );
    const hovered = (await read('prose')).prose.a;
    const resting = (await read('bare')).prose.a;
    expect(hovered).not.toEqual(resting);
  });

  for (const [hostName, host] of Object.entries(HOSTS)) {
    for (const [name, targets] of Object.entries(HOVER_CASES)) {
      for (const target of targets) {
        it(`${hostName}: ${name} ${target} computes the same hovered inside .prose`, async () => {
          const read = (root) =>
            load(
              {
                body: twoRoots(CASES[name].markup, { apart: true }),
                host,
                act: hover(`#${root} ${target}`),
              },
              readStyles,
              { targets: [target], properties: PROPERTIES },
            );
          const bare = (await read('bare')).bare[target];
          const prose = (await read('prose')).prose[target];
          expect(bare, `${target} rendered`).not.toBeNull();
          expect(prose, `${name} ${target} hovered`).toEqual(bare);
        });
      }
    }
  }

  /* The comparisons above are relative: a reset lost from both roots would
     still match. This pins the bare values to the system's own sizes, and
     Dialog and Sheet to each other, since the two sheets restate one block. */
  it('titles and descriptions sit at the system sizes, the same in Dialog and Sheet', async () => {
    const body =
      CASES.Dialog.markup +
      CASES.Sheet.markup +
      '<span id="fs-lg" style="font-size: var(--fs-lg)"></span>' +
      '<span id="fs-sm" style="font-size: var(--fs-sm)"></span>';
    const styles = await load(
      { body },
      (properties) => {
        const read = (selector) => {
          const style = getComputedStyle(document.querySelector(selector));
          return Object.fromEntries(properties.map((p) => [p, style.getPropertyValue(p)]));
        };
        return {
          dialogTitle: read('.ds-dialog__title'),
          sheetTitle: read('.ds-sheet__title'),
          dialogDescription: read('.ds-dialog__description'),
          sheetDescription: read('.ds-sheet__description'),
          lg: read('#fs-lg')['font-size'],
          sm: read('#fs-sm')['font-size'],
        };
      },
      PROPERTIES,
    );

    expect(styles.dialogTitle['font-size']).toBe(styles.lg);
    expect(styles.dialogDescription['font-size']).toBe(styles.sm);
    expect(styles.sheetTitle).toEqual(styles.dialogTitle);
    expect(styles.sheetDescription).toEqual(styles.dialogDescription);
  });

  /* #423: the active link and the current crumb tie the root-scoped link
     reset at (0,2,0) and win only on source order. Losing that would match
     bare and prose alike, so this pins what each state paints. */
  it('the active nav link and the current crumb keep their state styles', async () => {
    const body =
      CASES.NavigationMenu.markup +
      CASES.Breadcrumb.markup +
      '<span id="state" style="color: var(--fg); font-weight: var(--fw-medium)"></span>' +
      '<span id="rest" style="color: var(--fg-2)"></span>';
    const read = await load({ body }, () => {
      const style = (selector) => {
        const s = getComputedStyle(document.querySelector(selector));
        return { color: s.color, weight: s.fontWeight };
      };
      return {
        active: style('.ds-navigation-menu__link--active'),
        link: style('.ds-navigation-menu__link:not(.ds-navigation-menu__link--active)'),
        current: style('.ds-breadcrumb__link--current'),
        state: style('#state'),
        rest: style('#rest'),
      };
    });

    expect(read.active).toEqual(read.state);
    expect(read.current).toEqual(read.state);
    expect(read.link.color).toBe(read.rest.color);
    expect(read.link.weight).not.toBe(read.state.weight);
  });

  /* #414: the nested-list indent ties the root-scoped list reset at (0,2,0)
     and wins only on source order. Losing it would match bare and prose
     alike, so this pins it. */
  it('NavigationMenu still indents a nested list', async () => {
    const body =
      CASES.NavigationMenu.markup +
      '<span id="space-4" style="padding-left: var(--space-4)"></span>';
    const read = await load({ body }, () => ({
      nested: getComputedStyle(
        document.querySelector('.ds-navigation-menu__list .ds-navigation-menu__list'),
      ).paddingLeft,
      top: getComputedStyle(document.querySelector('.ds-navigation-menu__list')).paddingLeft,
      space4: getComputedStyle(document.getElementById('space-4')).paddingLeft,
    }));

    expect(read.top).toBe('0px');
    expect(read.nested).toBe(read.space4);
    expect(read.nested).not.toBe('0px');
  });

  /* The DecisionCard modifiers tie the root-scoped base rules at (0,2,0) and
     win only on source order. A swap would match bare and prose alike, so
     this pins what each modifier paints. */
  it('DecisionCard modifiers still restyle the figures they own', async () => {
    const body =
      CASES.DecisionCard.markup +
      `<div id="prose-layout">${CASES['DecisionCard, coded'].markup}</div>` +
      '<span id="tr-normal" style="letter-spacing: var(--tr-normal)"></span>' +
      '<span id="fs-md" style="font-size: var(--fs-md); font-weight: var(--fw-semibold)"></span>' +
      '<span id="fs-xs" style="font-size: var(--fs-xs); color: var(--fg-3)"></span>' +
      '<span id="fs-2xs" style="font-size: var(--fs-2xs); font-family: var(--font-mono)"></span>';
    const read = await load({ body }, () => {
      const style = (selector) => {
        const s = getComputedStyle(document.querySelector(selector));
        return {
          size: s.fontSize,
          weight: s.fontWeight,
          color: s.color,
          family: s.fontFamily,
          tracking: s.letterSpacing,
        };
      };
      return {
        total: style('.ds-decision__total .ds-decision__figure-label'),
        contrast: style('.ds-decision__contrast .ds-decision__figure-label'),
        prose: style('#prose-layout .ds-decision__figure-label'),
        coded: style('#prose-layout .ds-decision__headline'),
        trNormal: style('#tr-normal'),
        md: style('#fs-md'),
        xs: style('#fs-xs'),
        xxs: style('#fs-2xs'),
      };
    });

    expect(read.total.size).toBe(read.md.size);
    expect(read.total.weight).toBe(read.md.weight);
    expect(read.contrast.size).toBe(read.xs.size);
    expect(read.contrast.color).toBe(read.xs.color);
    expect(read.prose.size).toBe(read.xxs.size);
    expect(read.prose.family).toBe(read.xxs.family);
    expect(read.coded.tracking).toBe(read.trNormal.tracking);
  });

  it('lists carry no markers, bare or inside .prose', async () => {
    const { bare, prose } = await load(
      { body: twoRoots(CASES.CommandPalette.markup), host: HOSTS.tailwind },
      readStyles,
      { targets: PALETTE_LISTS, properties: ['list-style-type'] },
    );
    for (const styles of [bare, prose]) {
      for (const value of Object.values(styles)) expect(value['list-style-type']).toBe('none');
    }
  });
});

/** Where the open list sits against the input, in the given root layout. */
function measureList(rootStyle) {
  const root = document.querySelector('.ds-combobox');
  root.setAttribute('style', rootStyle);
  const box = root.getBoundingClientRect();
  const input = root.querySelector('.ds-search-field').getBoundingClientRect();
  const list = root.querySelector('.ds-combobox__list').getBoundingClientRect();
  return {
    inputBottom: input.bottom,
    rootLeft: box.left,
    rootRight: box.right,
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
    it(`${layout} root: the list opens below the input, across the root`, async () => {
      const box = await load({ body: COMBOBOX_OPEN }, measureList, rootStyle);
      expect(box.listTop).toBeGreaterThanOrEqual(box.inputBottom);
      // And it spans the root, whatever the root's main axis.
      expect(box.listLeft).toBeCloseTo(box.rootLeft, 0);
      expect(box.listRight).toBeCloseTo(box.rootRight, 0);
    });
  }
});
