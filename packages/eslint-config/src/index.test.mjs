// Deliberately bad fixtures. Each constraint the config claims to cover gets a
// case that must be flagged and a neighbouring case that must not be — a rule
// that fires on everything trains people to disable it.

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import cssModule from '@eslint/css';

import { designSystem } from './index.mjs';
import { designSystemCss } from './css.mjs';
import { readsAsControlEdge } from './rules/no-decorative-control-edge.mjs';
import { paintsAnEdge, statusFillState } from './rules/no-mismatched-status-foreground.mjs';
import { readsAsControl } from './rules/no-underlined-control-label.mjs';
import {
  DESIGN_PROPERTIES,
  axisForCssProperty,
  axisForJsProperty,
  isExempt,
} from './rules/value-patterns.mjs';

const linter = new Linter();

function lint(code, { filename = 'src/app/page.jsx', options } = {}) {
  const config = [
    {
      files: ['**/*.{js,jsx}'],
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    ...designSystem(options),
  ];

  return linter.verify(code, config, filename);
}

function lintCss(code, { filename = 'src/app/app.css', options } = {}) {
  return linter.verify(code, designSystemCss(options), filename);
}

const messagesOf = (results) => results.map((result) => result.message);
const rulesOf = (results) => results.map((result) => result.ruleId);

describe('no-barrel-imports', () => {
  it('flags a bare package specifier', () => {
    const results = lint("import { Button } from '@elirobinson/react'");

    expect(rulesOf(results)).toEqual(['no-restricted-imports']);
    expect(messagesOf(results)[0]).toContain('has no barrel export');
  });

  it('flags bare tokens and ai-patterns specifiers too', () => {
    expect(lint("import x from '@elirobinson/tokens'")).toHaveLength(1);
    expect(lint("import x from '@elirobinson/ai-patterns'")).toHaveLength(1);
  });

  it('allows a subpath import', () => {
    expect(
      lint("import { Button } from '@elirobinson/react/components/atoms/Button'"),
    ).toHaveLength(0);
    expect(lint("import '@elirobinson/tokens/tokens.css'")).toHaveLength(0);
  });
});

describe('foreign component libraries', () => {
  it.each([
    '@mui/material',
    '@chakra-ui/react',
    'antd',
    '@mantine/core',
    '@heroui/button',
    '@headlessui/react',
    'daisyui',
    'react-bootstrap',
  ])('flags %s', (specifier) => {
    const results = lint(`import x from '${specifier}'`);

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('Use @elirobinson/react instead');
  });

  it('allows an unrelated package', () => {
    expect(lint("import { z } from 'zod'")).toHaveLength(0);
  });
});

describe('direct Radix imports', () => {
  it('flags a direct primitive import', () => {
    const results = lint("import * as Dialog from '@radix-ui/react-dialog'");

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('already wraps these primitives');
  });

  it('allows it inside the sanctioned gap-filler directory', () => {
    const results = lint("import * as Dialog from '@radix-ui/react-dialog'", {
      filename: 'src/components/ui/dialog.jsx',
    });

    expect(results).toHaveLength(0);
  });

  it('still bans foreign libraries inside the gap-filler directory', () => {
    const results = lint("import x from '@mui/material'", {
      filename: 'src/components/ui/dialog.jsx',
    });

    expect(results).toHaveLength(1);
  });
});

describe('no-hardcoded-design-values: colour', () => {
  it.each([
    ['<div className="bg-[#0f172a]" />', '#0f172a'],
    ['<div className="text-[rgb(15,23,42)]" />', 'rgb(15,23,42)'],
    ['<div className="border-[oklch(72%_0.17_65)]" />', 'oklch'],
    ['<div style={{ color: "#fff" }} />', '#fff'],
    ['<div style={{ backgroundColor: "rgba(0,0,0,.5)" }} />', 'rgba'],
  ])('flags %s', (code, fragment) => {
    const results = lint(`export const A = () => (${code})`);

    expect(rulesOf(results)).toEqual(['@elirobinson/no-hardcoded-design-values']);
    expect(results[0].message).toContain('Hardcoded colour');
    expect(results[0].message).toContain(fragment.slice(0, 6));
  });

  it('flags a literal inside cn()', () => {
    const results = lint(
      `import { cn } from './cn'
       export const A = ({ on }) => <div className={cn('p-4', on && 'bg-[#ff0000]')} />`,
    );

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('Hardcoded colour');
  });

  it('reports a doubly-reachable literal once', () => {
    const results = lint(
      `import { cn } from './cn'
       export const A = () => <div className={cn('bg-[#ff0000]')} />`,
    );

    expect(results).toHaveLength(1);
  });

  it.each([
    '<div className="bg-background text-muted-foreground" />',
    '<div className="text-[var(--fg-2)]" />',
    '<div style={{ color: "var(--fg)" }} />',
    '<div style={{ color: "transparent" }} />',
  ])('allows %s', (code) => {
    expect(lint(`export const A = () => (${code})`)).toHaveLength(0);
  });
});

describe('no-hardcoded-design-values: radius, shadow, motion', () => {
  it.each([
    ['<div className="rounded-[8px]" />', 'radius'],
    ['<div className="rounded-tl-[0.5rem]" />', 'radius'],
    ['<div className="shadow-[0_4px_12px_rgba(0,0,0,0.1)]" />', 'shadow'],
    ['<div className="duration-[200ms]" />', 'motion'],
    ['<div className="ease-[cubic-bezier(0.4,0,0.2,1)]" />', 'motion'],
    ['<div style={{ borderRadius: "8px" }} />', 'radius'],
    ['<div style={{ boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />', 'shadow'],
    ['<div style={{ transitionDuration: "150ms" }} />', 'motion'],
  ])('flags %s', (code, kind) => {
    const results = lint(`export const A = () => (${code})`);

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain(
      { radius: 'Hardcoded radius', shadow: 'Hardcoded shadow', motion: 'Hardcoded motion' }[kind],
    );
  });

  it.each([
    '<div className="rounded-md shadow-sm duration-150" />',
    '<div className="rounded-[var(--radius-md)]" />',
    '<div className="shadow-[var(--shadow-md)]" />',
    '<div className="duration-[var(--dur-fast)]" />',
    '<div style={{ borderRadius: "var(--radius-lg)" }} />',
    '<div className="p-4 gap-2 grid-cols-[1fr_320px]" />',
  ])('allows %s', (code) => {
    expect(lint(`export const A = () => (${code})`)).toHaveLength(0);
  });

  it('leaves layout arbitrary values alone', () => {
    expect(lint('export const A = () => <div className="w-[320px] h-[48px]" />')).toHaveLength(0);
  });
});

describe('configurability', () => {
  it('honours a custom severity', () => {
    const results = lint("import x from '@elirobinson/react'", {
      options: { severity: 'warn' },
    });

    expect(results[0].severity).toBe(1);
  });

  it('honours an allow list', () => {
    const results = lint('export const A = () => <div className="bg-[#ff0000]" />', {
      options: { hardcodedValues: { allow: ['#ff0000'] } },
    });

    expect(results).toHaveLength(0);
  });

  it('honours a custom class-name helper name', () => {
    const results = lint(`export const A = () => <div className={tw('bg-[#ff0000]')} />`, {
      options: { hardcodedValues: { classNameFunctions: ['tw'] } },
    });

    expect(results).toHaveLength(1);
  });

  it('can drop the gap-filler exemption entirely', () => {
    const results = lint("import * as D from '@radix-ui/react-dialog'", {
      filename: 'src/components/ui/dialog.jsx',
      options: { gapFiller: [] },
    });

    expect(results).toHaveLength(1);
  });
});

describe('CSS', () => {
  it('has the css language available', () => {
    expect(cssModule.languages['css']).toBeTruthy();
  });

  it.each([
    ['a { color: #0f172a; }', 'Hardcoded colour'],
    ['a { background-color: oklch(72% 0.17 65); }', 'Hardcoded colour'],
    ['a { border-radius: 8px; }', 'Hardcoded radius'],
    ['a { box-shadow: 0 4px 12px rgba(0,0,0,.1); }', 'Hardcoded shadow'],
    ['a { transition-duration: 200ms; }', 'Hardcoded motion'],
    ['a { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }', 'Hardcoded motion'],
  ])('flags %s', (code, fragment) => {
    const results = lintCss(code);

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain(fragment);
  });

  it.each([
    'a { color: var(--fg); }',
    'a { border-radius: var(--radius-md); }',
    'a { box-shadow: var(--shadow-md); }',
    'a { transition: color var(--dur-fast) var(--ease-out); }',
    'a { padding: 16px; }',
    'a { color: transparent; }',
  ])('allows %s', (code) => {
    expect(lintCss(code)).toHaveLength(0);
  });

  it('leaves custom-property definitions alone — that is what a token is', () => {
    expect(lintCss(':root { --accent: oklch(72.5% 0.175 65); --radius-md: 6px; }')).toHaveLength(0);
  });

  it('can be pointed away from a stylesheet that defines values', () => {
    const results = lintCss('a { color: #fff; }', {
      filename: 'src/styles/tokens.css',
      options: { ignores: ['**/tokens.css'] },
    });

    // Linter#verify still returns the "file is ignored" notice; what matters is
    // that no rule fired.
    expect(results.filter((result) => result.ruleId)).toHaveLength(0);
  });
});

// The two rules answer the same question about a value and only differ in how
// they reach it, so every case below is asserted in both languages. A future
// change that teaches one rule something the other does not know fails here
// rather than shipping — which is how `color(display-p3 ...)` came to be an
// error in a .tsx and silent in a .css.
//
// Exemptions that no check could have flagged anyway — `revert` is the case —
// cannot fail at this level in both languages however wrong they get. Those are
// pinned directly against isExempt below instead.
describe('the JS and CSS rules agree about values', () => {
  it.each([
    {
      what: 'color() is a colour function like any other',
      js: '<div style={{ color: "color(display-p3 1 0 0)" }} />',
      css: 'a { color: color(display-p3 1 0 0); }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a hex literal',
      js: '<div style={{ color: "#0f172a" }} />',
      css: 'a { color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a magic radius',
      js: '<div style={{ borderRadius: "8px" }} />',
      css: 'a { border-radius: 8px; }',
      flagged: 'Hardcoded radius',
    },
    {
      what: 'a magic duration',
      js: '<div style={{ transitionDuration: "200ms" }} />',
      css: 'a { transition-duration: 200ms; }',
      flagged: 'Hardcoded motion',
    },
    {
      what: 'zero is zero, not a design decision',
      js: '<div style={{ borderRadius: "0px" }} />',
      css: 'a { border-radius: 0px; }',
      flagged: null,
    },
    {
      what: 'revert is a CSS-wide keyword, valid in a style object too',
      js: '<div style={{ color: "revert" }} />',
      css: 'a { color: revert; }',
      flagged: null,
    },
    {
      // Tailwind v3's dot syntax — theme(colors.slate.200) — is not parseable
      // CSS, so the form that can reach the CSS rule is Tailwind v4's.
      what: "Tailwind's theme() resolves to a token",
      js: '<div style={{ boxShadow: "0 1px 2px theme(--color-slate-200)" }} />',
      css: 'a { box-shadow: 0 1px 2px theme(--color-slate-200); }',
      flagged: null,
    },
    {
      what: 'a var() reference',
      js: '<div style={{ color: "var(--fg)" }} />',
      css: 'a { color: var(--fg); }',
      flagged: null,
    },
  ])('$what', ({ js, css, flagged }) => {
    const jsResults = lint(`export const A = () => (${js})`);
    const cssResults = lintCss(css);

    if (flagged) {
      expect(messagesOf(jsResults)).toHaveLength(1);
      expect(messagesOf(cssResults)).toHaveLength(1);
      expect(jsResults[0].message).toContain(flagged);
      expect(cssResults[0].message).toContain(flagged);
    } else {
      expect(messagesOf(jsResults)).toEqual([]);
      expect(messagesOf(cssResults)).toEqual([]);
    }
  });
});

// The value half of the question is settled above. This is the property half:
// which *axis* a property belongs to — colour, radius, shadow or motion. That
// used to be answered separately in each rule, off a camelCase Set on one side
// and a kebab-case regex on the other, and had drifted the same way the regexes
// had: `filter: drop-shadow(...)` was an error in a style object and silent in a
// stylesheet, and `text-shadow: 0 0 rgb(...)` reported two different message ids
// depending on the language.
//
// Both rules now read the axis from one table in value-patterns.mjs, so a
// property has exactly one axis and both spellings of it resolve to the same
// one. The generated case below walks that table; the hand-written cases pin the
// specific disagreements that were reconciled.
describe('the JS and CSS rules agree about which axis a property belongs to', () => {
  it('every property in the table resolves to the same axis in both spellings', () => {
    expect(DESIGN_PROPERTIES.length).toBeGreaterThan(0);

    for (const { js, css, axis } of DESIGN_PROPERTIES) {
      expect(axisForJsProperty(js)?.name, `${js} (js)`).toBe(axis);
      expect(axisForCssProperty(css)?.name, `${css} (css)`).toBe(axis);
      // Same axis object, not merely the same name — one predicate, not two.
      expect(axisForCssProperty(css), `${css} vs ${js}`).toBe(axisForJsProperty(js));
    }
  });

  it('no property sits on two axes', () => {
    const seen = new Map();

    for (const { js, axis } of DESIGN_PROPERTIES) {
      expect(seen.has(js), `${js} listed twice`).toBe(false);
      seen.set(js, axis);
    }
  });

  it.each([
    {
      what: 'a filter carrying a drop-shadow is a shadow',
      js: '<div style={{ filter: "drop-shadow(0 4px 8px #000)" }} />',
      css: 'a { filter: drop-shadow(0 4px 8px #000); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'a backdrop-filter carrying a drop-shadow is a shadow',
      js: '<div style={{ backdropFilter: "drop-shadow(0 4px 8px #000)" }} />',
      css: 'a { backdrop-filter: drop-shadow(0 4px 8px #000); }',
      flagged: 'Hardcoded shadow',
    },
    {
      // A blur radius is not a shadow, and "use shadow-md" is wrong advice for
      // it. filter only counts on the shadow axis when it carries a shadow.
      what: 'a filter that is not a shadow is not a shadow',
      js: '<div style={{ filter: "blur(4px)" }} />',
      css: 'a { filter: blur(4px); }',
      flagged: null,
    },
    {
      // Reported as a shadow in both, not as a stray colour in one of them:
      // box-shadow's axis is shadow whatever the value happens to carry.
      what: 'a shadow whose only literal is a colour is still a shadow',
      js: '<div style={{ textShadow: "0 0 rgb(0 0 0 / .5)" }} />',
      css: 'a { text-shadow: 0 0 rgb(0 0 0 / .5); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'a box-shadow whose only literal is a colour is still a shadow',
      js: '<div style={{ boxShadow: "0 0 rgb(0 0 0 / .5)" }} />',
      css: 'a { box-shadow: 0 0 rgb(0 0 0 / .5); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'a box-shadow with a magic length is a shadow',
      js: '<div style={{ boxShadow: "0 4px 12px rgba(0,0,0,.1)" }} />',
      css: 'a { box-shadow: 0 4px 12px rgba(0,0,0,.1); }',
      flagged: 'Hardcoded shadow',
    },
    {
      what: 'column-rule-color is a colour',
      js: '<div style={{ columnRuleColor: "#0f172a" }} />',
      css: 'a { column-rule-color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a logical border colour is a colour',
      js: '<div style={{ borderBlockColor: "#0f172a" }} />',
      css: 'a { border-block-color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a two-segment logical border colour is a colour',
      js: '<div style={{ borderInlineStartColor: "#0f172a" }} />',
      css: 'a { border-inline-start-color: #0f172a; }',
      flagged: 'Hardcoded colour',
    },
    {
      what: 'a logical border radius is a radius',
      js: '<div style={{ borderStartStartRadius: "8px" }} />',
      css: 'a { border-start-start-radius: 8px; }',
      flagged: 'Hardcoded radius',
    },
  ])('$what', ({ js, css, flagged }) => {
    const jsResults = lint(`export const A = () => (${js})`);
    const cssResults = lintCss(css);

    if (flagged) {
      expect(messagesOf(jsResults)).toHaveLength(1);
      expect(messagesOf(cssResults)).toHaveLength(1);
      expect(jsResults[0].message).toContain(flagged);
      expect(cssResults[0].message).toContain(flagged);
    } else {
      expect(messagesOf(jsResults)).toEqual([]);
      expect(messagesOf(cssResults)).toEqual([]);
    }
  });
});

describe('no-padded-ui-copy', () => {
  const copyOf = (results) => results.filter((r) => r.ruleId === '@elirobinson/no-padded-ui-copy');

  describe('chrome: JSX text inside a chrome component', () => {
    it.each([
      [
        'unverifiable frequency',
        '<Alert>This almost always clears on its own.</Alert>',
        'frequency',
      ],
      ['blame attribution', '<Alert>Something failed on their side.</Alert>', 'blame'],
      ['filler pacing', '<Toast>Saved. Your export lands in a moment.</Toast>', 'pacing'],
      [
        'unprompted reassurance',
        "<Alert>Upload failed. Don't worry, retry.</Alert>",
        'reassurance',
      ],
      ['apology', '<Alert>Sorry about that. Try again.</Alert>', 'reassurance'],
      [
        'unasked escalation',
        '<Callout>Import failed. If it keeps happening, contact support.</Callout>',
        'escalation',
      ],
      ['enthusiasm', '<Banner>Great news, your plan is active.</Banner>', 'enthusiasm'],
    ])('flags %s', (_what, jsx) => {
      const results = copyOf(lint(`export const A = () => (${jsx})`));

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].message).toContain('Functional UI copy');
    });

    it('flags the phrase even when JSX wraps it across lines', () => {
      const results = copyOf(
        lint(`export const A = () => (
          <Alert>
            You have not been charged. This is almost always a passing blip on
            their side, so try again in a moment.
          </Alert>
        )`),
      );

      expect(results.map((r) => r.messageId).sort()).toEqual(['blame', 'frequency', 'pacing']);
    });

    it('reads a curly apostrophe as an apostrophe', () => {
      expect(copyOf(lint('export const A = () => (<Alert>Don’t worry.</Alert>)'))).toHaveLength(1);
    });

    it('flags an exclamation mark', () => {
      const results = copyOf(lint('export const A = () => (<Toast>Saved!</Toast>)'));

      expect(results).toHaveLength(1);
      expect(results[0].messageId).toBe('exclamation');
    });

    it('collects text through nested markup', () => {
      const results = copyOf(
        lint('export const A = () => (<Alert>Failed. <strong>Hang tight</strong>.</Alert>)'),
      );

      expect(results).toHaveLength(1);
    });

    it('reports a nested chrome component once, not once per level', () => {
      const results = copyOf(
        lint(
          'export const A = () => (<Alert><AlertDescription>Hang tight.</AlertDescription></Alert>)',
        ),
      );

      expect(results).toHaveLength(1);
    });

    it('resolves a namespaced chrome component', () => {
      expect(
        copyOf(lint('export const A = () => (<Toast.Description>Hang tight.</Toast.Description>)')),
      ).toHaveLength(1);
    });

    it('leaves chrome that states the fact and the action alone', () => {
      expect(
        copyOf(
          lint('export const A = () => (<Alert>You have not been charged. Try again.</Alert>)'),
        ),
      ).toEqual([]);
      expect(
        copyOf(
          lint('export const A = () => (<Alert>No invoices yet. Create one to start.</Alert>)'),
        ),
      ).toEqual([]);
    });
  });

  describe('content: everything that is not chrome', () => {
    // The carve-out. A product's editorial voice is not this rule's business,
    // and a rule that flattened it would do more harm than the padding does.
    it.each([
      '<p>Don’t worry about the weather — we’ll sort it out when you arrive.</p>',
      '<section><h1>Great news!</h1><p>This rarely happens to a house this size.</p></section>',
      '<article>Hang tight, the best cabins go in a moment.</article>',
    ])('leaves prose alone: %s', (jsx) => {
      expect(copyOf(lint(`export const A = () => (${jsx})`))).toEqual([]);
    });

    it('leaves a non-copy prop alone', () => {
      expect(copyOf(lint('export const A = () => (<Card slug="dont-worry-its-fine" />)'))).toEqual(
        [],
      );
    });
  });

  describe('copy props, on any component', () => {
    it.each(['title', 'description', 'label', 'placeholder', 'helperText', 'aria-label'])(
      'flags %s',
      (prop) => {
        const results = copyOf(lint(`export const A = () => (<Field ${prop}="Hang tight" />)`));

        expect(results).toHaveLength(1);
        expect(results[0].messageId).toBe('pacing');
      },
    );

    it('reads through an expression container', () => {
      expect(
        copyOf(
          lint('export const A = () => (<Field title={ok ? "Saved" : "Sorry about that"} />)'),
        ),
      ).toHaveLength(1);
    });

    it('reports one message per node, not one per branch', () => {
      expect(
        copyOf(lint('export const A = () => (<Field title={ok ? "Saved!" : "Done!"} />)')),
      ).toHaveLength(1);
      expect(
        copyOf(
          lint('export const A = () => (<Field title={ok ? "Hang tight" : "Hang tight now"} />)'),
        ),
      ).toHaveLength(1);
    });

    it('says nothing about a prop whose value it cannot see', () => {
      expect(copyOf(lint('export const A = () => (<Field title={t("errors.stripe")} />)'))).toEqual(
        [],
      );
    });
  });

  describe('rollout', () => {
    it('warns rather than errors, even where the rest of the config is an error', () => {
      const results = copyOf(lint('export const A = () => (<Alert>Hang tight.</Alert>)'));

      expect(results[0].severity).toBe(1);
    });

    it('takes an error severity when a repo asks for one', () => {
      const results = copyOf(
        lint('export const A = () => (<Alert>Hang tight.</Alert>)', {
          options: { copy: { severity: 'error' } },
        }),
      );

      expect(results[0].severity).toBe(2);
    });

    it('switches off entirely', () => {
      expect(
        copyOf(
          lint('export const A = () => (<Alert>Hang tight.</Alert>)', {
            options: { copy: { severity: 'off' } },
          }),
        ),
      ).toEqual([]);
    });

    it('takes an allow list for a phrase a repo has decided to keep', () => {
      expect(
        copyOf(
          lint('export const A = () => (<Alert>Hang tight.</Alert>)', {
            options: { copy: { allow: ['hang tight'] } },
          }),
        ),
      ).toEqual([]);
    });

    it('takes extra chrome components', () => {
      expect(
        copyOf(
          lint('export const A = () => (<Snackbar>Hang tight.</Snackbar>)', {
            options: { copy: { components: ['Snackbar'] } },
          }),
        ),
      ).toHaveLength(1);
    });

    it('takes extra copy props', () => {
      expect(
        copyOf(
          lint('export const A = () => (<Field blurb="Hang tight" />)', {
            options: { copy: { props: ['blurb'] } },
          }),
        ),
      ).toHaveLength(1);
    });
  });
});

// The reported pattern in #62: an orange fill, a black label, and a black
// underline under it. The colours measured fine (--accent-fg on --accent is
// 8.30:1); the underline is the defect, because it is the one signal a
// hyperlink owns. Every flagged case here has a neighbour that must stay
// silent — a link that underlines, and a control that does not fill.
describe('no-underlined-control-label', () => {
  const messagesFor = (css) =>
    lintCss(css)
      .filter((result) => result.ruleId?.endsWith('no-underlined-control-label'))
      .map((result) => result.message);

  it.each([
    ['the reported button', '.btn { background: var(--accent); text-decoration: underline; }'],
    [
      'the longhand spelling',
      '.cta-primary { background-color: var(--accent); text-decoration-line: underline; }',
    ],
    [
      'a state rule',
      'button:hover { background-color: var(--accent-hover); text-decoration: underline; }',
    ],
    ['a bare button element', 'button { background: var(--accent); text-decoration: underline; }'],
    [
      'an anchor wearing a button class',
      'a.btn { background: var(--accent); text-decoration: underline; }',
    ],
    [
      'a role attribute instead of a class',
      '[role="button"] { background: var(--accent); text-decoration: underline; }',
    ],
    [
      'underline alongside other decoration keywords',
      '.chip { background: var(--accent-tint); text-decoration: underline dotted; }',
    ],
  ])('flags %s', (_what, css) => {
    const messages = messagesFor(css);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('reads as a hyperlink wearing a button');
  });

  it.each([
    ['a link, which is what an underline is for', 'a { background: var(--accent-tint); }'],
    [
      'a link that underlines on a fill — still a link',
      '.footnote-link { background: var(--accent-tint); text-decoration: underline; }',
    ],
    [
      'a link-style button on no fill, a deliberate pattern',
      '.btn--link { background: transparent; text-decoration: underline; }',
    ],
    ['a control that omits the background entirely', '.btn--ghost { text-decoration: underline; }'],
    ['a control that drops the underline', '.btn { background: var(--accent); }'],
    ['the shipped declaration', '.ds-button { background: var(--accent); text-decoration: none; }'],
    [
      'a hover affordance that thickens a line it did not draw',
      '.ds-button a:hover { text-decoration-thickness: 2px; }',
    ],
    ['a word that merely contains a control word', '.data-table { text-decoration: underline; }'],
    [
      'a table cell, which is not a tab',
      '.data-table__cell { background: var(--bg-subtle); text-decoration: underline; }',
    ],
  ])('stays silent on %s', (_what, css) => {
    expect(messagesFor(css)).toEqual([]);
  });

  it('names the two declarations that produced the pattern', () => {
    const [message] = messagesFor(
      '.btn--accent { background: var(--accent); color: var(--accent-fg); text-decoration: underline; }',
    );

    expect(message).toContain('.btn--accent');
    expect(message).toContain('background: var(--accent)');
    expect(message).toContain('text-decoration: underline');
  });
});

describe('readsAsControl', () => {
  it.each([
    ['button', true],
    ['a.btn', true],
    ['.card > button:hover', true],
    ['[type="submit"]', true],
    ['[role="tab"]', true],
    ['.toolbarActions', true],
    ['.ds-pagination__item', true],
    ['a', false],
    ['.card', false],
    ['.data-table', false],
    // A substring match would read "tab" out of this and "badge" out of the
    // next; whole words are what keep the rule from firing on prose.
    ['.timetable-row', false],
    ['.badger-den', false],
    ['.buttonish', false],
  ])('%j is %s', (selector, expected) => {
    expect(readsAsControl(selector)).toBe(expected);
  });
});

// The edge half of the same class of defect. --border and --border-strong
// measure correctly as decorative hairlines and are the wrong token the moment
// the line is what tells a user a control is there. Every flagged case has a
// neighbour that must stay silent — a surface seam, a geometry longhand, and a
// control that already reached for --border-control.
describe('no-decorative-control-edge', () => {
  const messagesFor = (css) =>
    lintCss(css)
      .filter((result) => result.ruleId?.endsWith('no-decorative-control-edge'))
      .map((result) => result.message);

  it.each([
    ['an input edge', '.ds-input { border: 1px solid var(--border); }'],
    [
      'the emphasized decorative token',
      '.search-field { border: 1px solid var(--border-strong); }',
    ],
    ['a bare input element', 'input { border: 1px solid var(--border); }'],
    ['a border-color longhand', '.chip { border-color: var(--border); }'],
    ['a single side', '.segmented-control { border-bottom: 1px solid var(--border); }'],
    ['a logical longhand', '.stepper__indicator { border-inline-start-color: var(--border); }'],
    ['a state rule', '.btn:hover { border-color: var(--border-strong); }'],
    ['a role attribute instead of a class', '[role="switch"] { border: 1px solid var(--border); }'],
    [
      'a type attribute instead of a class',
      '[type="checkbox"] { border: 1px solid var(--border); }',
    ],
    [
      'a trigger, which is a control even inside an overlay',
      '.popover__trigger { border: 1px solid var(--border); }',
    ],
  ])('flags %s', (_what, css) => {
    const messages = messagesFor(css);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('var(--border-control)');
  });

  it.each([
    ['a card seam, which is what --border is for', '.card { border: 1px solid var(--border); }'],
    ['a table rule', '.data-table__cell { border-bottom: 1px solid var(--border); }'],
    ['a divider', '.stack__divider { border-top: 1px solid var(--border-strong); }'],
    [
      'an outline badge, which is a label and not a control',
      '.ds-badge--outline { border: 1px solid var(--border-strong); }',
    ],
    ['the rule under a tab strip', '.ds-tabs__list { border-bottom: 1px solid var(--border); }'],
    ['a floating panel a widget opens', '.ds-combobox__list { border: 1px solid var(--border); }'],
    [
      'a control that already uses the right token',
      '.ds-input { border: 1px solid var(--border-control); }',
    ],
    [
      'a control edge painted with a status token',
      '.ds-input--error { border-color: var(--status-danger); }',
    ],
    [
      'geometry, which paints no line',
      '.btn { border-radius: var(--radius-sm); border-width: 1px; }',
    ],
    ['a control with no border at all', '.btn { background: var(--accent); }'],
    [
      'an outline, which is not a border',
      '.btn:focus-visible { outline: 2px solid var(--focus-ring); }',
    ],
    [
      'a word that merely contains a control word',
      '.timetable-row { border: 1px solid var(--border); }',
    ],
    ['a zero border, which paints nothing', '.field__figure { border: 0; }'],
  ])('stays silent on %s', (_what, css) => {
    expect(messagesFor(css)).toEqual([]);
  });

  it('names the selector, the declaration and the token', () => {
    const [message] = messagesFor('.ds-switch__track { border: 1px solid var(--border); }');

    expect(message).toContain('.ds-switch__track');
    expect(message).toContain('border: 1px solid var(--border)');
    expect(message).toContain('--border');
  });
});

describe('readsAsControlEdge', () => {
  it.each([
    ['.ds-input', true],
    ['input', true],
    ['textarea', true],
    ['[type="search"]', true],
    ['[role="combobox"]', true],
    ['.search-field__control', true],
    ['.ds-switch__track', true],
    ['.btn', true],
    ['.ds-pagination__item', true],
    // Narrower than readsAsControl on purpose: these paint a fill, so an
    // underline in them is a defect, but their border is trim.
    ['.ds-badge--outline', false],
    ['.ds-tabs__list', false],
    ['.ds-combobox__list', false],
    ['.ds-date-picker__popover', false],
    ['.card', false],
    ['.panel', false],
    ['.data-table', false],
    // Whole words, so prose that merely contains one does not match.
    ['.switchboard-diagram', false],
    ['.inputted', false],
    // `field` is claimed on purpose: `.form-field` / `.field__control` is the
    // canonical bordered input, and the cost of the collision is one selector
    // told to use a more visible edge.
    ['.field-guide', true],
  ])('%j is %s', (selector, expected) => {
    expect(readsAsControlEdge(selector)).toBe(expected);
  });
});

// The status surfaces. --status-success and --status-warning stopped being
// brand aliases and now own their hues, which is what makes the two habits
// below wrong: a foreground that flips with the theme no longer tracks a fill
// that does not, and a warning hue that is a legible fill at 1.87:1 is not a
// legible line. Every flagged case has a neighbour that must stay silent — the
// already-migrated token, the tint pair, a geometry longhand, and a bare
// warning fill, which is correct.
describe('no-mismatched-status-foreground', () => {
  const messagesFor = (css) =>
    lintCss(css)
      .filter((result) => result.ruleId?.endsWith('no-mismatched-status-foreground'))
      .map((result) => result.message);

  it.each([
    [
      'inverted text on a danger fill',
      '.toast--error { background: var(--status-danger); color: var(--fg-inverse); }',
      'var(--status-danger-on)',
    ],
    [
      'a success fill',
      '.badge--ok { background: var(--status-success); color: var(--fg-inverse); }',
      'var(--status-success-on)',
    ],
    [
      'a warning fill, where the text on it is the only contrast there is',
      '.banner--warn { background: var(--status-warning); color: var(--fg-inverse); }',
      'var(--status-warning-on)',
    ],
    [
      'an info fill',
      '.tip { background: var(--status-info); color: var(--fg-inverse); }',
      'var(--status-info-on)',
    ],
    [
      'the background-color longhand',
      '.dot { background-color: var(--status-danger); color: var(--fg-inverse); }',
      'var(--status-danger-on)',
    ],
    [
      'the foreground declared before the fill',
      '.pill { color: var(--fg-inverse); background: var(--status-danger); }',
      'var(--status-danger-on)',
    ],
    [
      'a fill written with a fallback',
      '.pill { background: var(--status-danger, #b91c1c); color: var(--fg-inverse); }',
      'var(--status-danger-on)',
    ],
    [
      'a state rule',
      '.alert:hover { background: var(--status-warning); color: var(--fg-inverse); }',
      'var(--status-warning-on)',
    ],
  ])('flags %s', (_what, css, replacement) => {
    const messages = messagesFor(css);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(replacement);
  });

  it.each([
    ['a border shorthand', '.callout { border: 1px solid var(--status-warning); }'],
    ['a border-color longhand', '.callout { border-color: var(--status-warning); }'],
    ['a single side', '.row { border-left: 3px solid var(--status-warning); }'],
    ['a logical longhand', '.row { border-inline-start-color: var(--status-warning); }'],
    ['an outline', '.field:focus-visible { outline: 2px solid var(--status-warning); }'],
    ['an outline-color longhand', '.field { outline-color: var(--status-warning); }'],
    ['a column rule', '.cols { column-rule: 1px solid var(--status-warning); }'],
    ['a column-rule-color longhand', '.cols { column-rule-color: var(--status-warning); }'],
    [
      'an edge written with a fallback',
      '.callout { border-color: var(--status-warning, #b45309); }',
    ],
  ])('flags the warning hue painting %s', (_what, css) => {
    const messages = messagesFor(css);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('var(--status-warning-border)');
  });

  it.each([
    ['as text on a plain background', '.note { color: var(--fg-on-signal); }'],
    ['as a border colour', '.note { border-color: var(--fg-on-signal); }'],
    ['inside a shorthand', '.note { border: 1px solid var(--fg-on-signal); }'],
    ['written with a fallback', '.note { color: var(--fg-on-signal, #ffffff); }'],
    // The opposite of no-hardcoded-design-values, which exempts `--*` because
    // defining a value is what a token layer is for. Aliasing a legacy token
    // into a name of your own is not defining anything.
    [
      'aliased into a consumer’s own custom property',
      ':root { --my-badge-fg: var(--fg-on-signal); }',
    ],
  ])('flags the legacy --fg-on-signal %s', (_what, css) => {
    const messages = messagesFor(css);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('var(--accent-fg)');
  });

  it.each([
    [
      'the correct pairing',
      '.badge { background: var(--status-warning); color: var(--status-warning-on); }',
    ],
    ['an already-migrated edge', '.callout { border-color: var(--status-warning-border); }'],
    // The exception is real: the hue is legible as a fill because the text on
    // it carries the contrast. Only the line is wrong.
    ['a bare warning fill, which is correct', '.callout { background: var(--status-warning); }'],
    [
      'the tint pair, which has nothing to do with the fill pair',
      '.panel { background: var(--status-danger-tint); color: var(--status-danger-fg); }',
    ],
    ['a tint edge on a border', '.panel { border-color: var(--status-warning-tint-edge); }'],
    [
      'the tint pair with its own edge',
      '.panel { background: var(--status-warning-tint); border: 1px solid var(--status-warning-tint-edge); color: var(--status-warning-fg); }',
    ],
    [
      'a danger badge that already uses the right foreground',
      '.badge--danger { background: var(--status-danger); color: var(--status-danger-on); }',
    ],
    ['status-coloured text on a neutral surface', '.hint { color: var(--status-warning-fg); }'],
    [
      '--fg-inverse on an inverted band, which is exactly what it is for',
      '.hero { background: var(--bg-inverse); color: var(--fg-inverse); }',
    ],
    [
      '--fg-inverse over a status tint, which is not the fill pair',
      '.panel { background: var(--status-info-tint); color: var(--fg-inverse); }',
    ],
    ['the accent pair', '.btn { background: var(--accent); color: var(--accent-fg); }'],
    // The same fixture no-decorative-control-edge keeps as a negative. A
    // non-warning status hue on an edge is not this rule's business.
    [
      'a control edge painted with a non-warning status token',
      '.ds-input--error { border-color: var(--status-danger); }',
    ],
    ['geometry, which paints no line', '.chip { border-radius: var(--radius-2); }'],
    [
      'a border width, which carries no colour',
      '.chip { border-width: var(--border-width-thick); }',
    ],
    // Deciding this needs a cascade resolver and a DOM, so it is out of scope
    // on purpose rather than by accident.
    [
      'a fill and a foreground in different blocks',
      '.badge { background: var(--status-danger); } .badge__label { color: var(--fg-inverse); }',
    ],
  ])('stays silent on %s', (_what, css) => {
    expect(messagesFor(css)).toEqual([]);
  });

  it('names the selector, both declarations, the state and the exact replacement', () => {
    const [message] = messagesFor(
      '.toast--error { background: var(--status-danger); color: var(--fg-inverse); }',
    );

    expect(message).toContain('.toast--error');
    expect(message).toContain('background: var(--status-danger)');
    expect(message).toContain('color: var(--fg-inverse)');
    expect(message).toContain('var(--status-danger-on)');
  });

  it('names the declaration and the edge token it should have used', () => {
    const [message] = messagesFor('.callout { border-left: 3px solid var(--status-warning); }');

    expect(message).toContain('border-left: 3px solid var(--status-warning)');
    expect(message).toContain('var(--status-warning-border)');
    expect(message).toContain('1.87:1');
  });

  // Both halves are true at once and both are worth saying: the alias is
  // legacy everywhere, and here specifically it is also the wrong kind of
  // foreground. Asserted rather than left to fall out of the implementation.
  it('reports twice on --fg-on-signal inside a status fill block', () => {
    const messages = messagesFor(
      '.badge--ok { background: var(--status-success); color: var(--fg-on-signal); }',
    );

    expect(messages).toHaveLength(2);
    expect(messages.some((message) => message.includes('var(--status-success-on)'))).toBe(true);
    expect(messages.some((message) => message.includes('var(--accent-fg)'))).toBe(true);
  });
});

describe('paintsAnEdge', () => {
  it.each([
    ['border', true],
    ['border-color', true],
    ['border-top', true],
    ['border-inline-start-color', true],
    ['border-block-end', true],
    ['outline', true],
    ['outline-color', true],
    ['column-rule', true],
    ['column-rule-color', true],
    // Geometry, which never carries the line's colour.
    ['border-radius', false],
    ['border-width', false],
    ['border-style', false],
    ['border-top-width', false],
    ['border-inline-start-style', false],
    ['border-spacing', false],
    ['border-collapse', false],
    ['border-image', false],
    ['border-image-source', false],
    ['outline-width', false],
    ['outline-style', false],
    ['background', false],
    ['color', false],
  ])('%j is %s', (property, expected) => {
    expect(paintsAnEdge(property)).toBe(expected);
  });
});

describe('statusFillState', () => {
  it.each([
    ['var(--status-danger)', 'danger'],
    ['var(--status-success)', 'success'],
    ['var(--status-warning)', 'warning'],
    ['var(--status-info)', 'info'],
    ['var(--status-danger, #b91c1c)', 'danger'],
    ['linear-gradient(var(--status-info), var(--bg))', 'info'],
    // The whole-reference terminator is what keeps the rest of the family out.
    // Every one of these is a fix, and flagging a fix tells a consumer who
    // already migrated to migrate again.
    ['var(--status-warning-border)', null],
    ['var(--status-warning-on)', null],
    ['var(--status-warning-fg)', null],
    ['var(--status-warning-tint)', null],
    ['var(--status-warning-tint-edge)', null],
    ['var(--status-danger-on)', null],
    ['var(--accent)', null],
    ['transparent', null],
  ])('%j is %s', (value, expected) => {
    expect(statusFillState(value)).toBe(expected);
  });
});

describe('isExempt', () => {
  it.each([
    ['var(--fg)', true],
    ['theme(colors.accent)', true],
    ['0', true],
    ['0px', true],
    ['revert', true],
    ['  transparent  ', true],
    ['#0f172a', false],
    ['color(display-p3 1 0 0)', false],
    ['0.5rem', false],
    ['revert-layer', false],
  ])('%j is %s', (value, expected) => {
    expect(isExempt(value)).toBe(expected);
  });

  it('a token reference anywhere in the value exempts the whole of it', () => {
    expect(isExempt('0 1px 2px var(--shadow-hue)')).toBe(true);
    expect(isExempt('0 1px 2px theme(--color-slate-200)')).toBe(true);
    expect(isExempt('0 1px 2px #e2e8f0')).toBe(false);
  });
});
