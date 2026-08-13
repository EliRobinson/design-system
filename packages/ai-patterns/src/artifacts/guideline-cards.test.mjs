/* The generated foundation cards.
 *
 * The case that matters is completeness: the hand-authored ink card rendered
 * 10 of 13 steps, and nothing caught it. A generated card must show every step
 * tokens.css defines, so adding one to the stylesheet is the whole change.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import { describe, expect, it } from 'vitest';

import { buildGuidelineCards } from './guideline-cards.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const tokens = parseTokensCss(
  readFileSync(join(repoRoot, 'packages/tokens/src/tokens.css'), 'utf8'),
);

const cards = buildGuidelineCards(tokens);
const cardAt = (path) => cards.find((entry) => entry.path === path).html;
const swatchCount = (html, prefix) =>
  new Set(html.match(new RegExp(`var\\(${prefix}[\\w-]+\\)`, 'g')) ?? []).size;
/* The named sets share no prefix, so counting the chips the swatch helper emits
   is what catches a dropped name there. */
const chipCount = (html) => (html.match(/width:56px;height:48px/g) ?? []).length;
const without = (...names) => tokens.filter((token) => !names.includes(token.name));

describe('completeness against tokens.css', () => {
  it('renders every ink step — the regression the hand-written card had', () => {
    const defined = tokens.filter((token) => /^--ink-\d+$/.test(token.name));
    expect(defined.length).toBe(13);
    expect(swatchCount(cardAt('colors-ink.html'), '--ink-')).toBe(13);
  });

  it('includes the steps the old card silently dropped', () => {
    const html = cardAt('colors-ink.html');
    for (const missing of ['--ink-700', '--ink-900', '--ink-950']) {
      expect(html).toContain(`var(${missing})`);
    }
  });

  it('renders every signal and anchor step', () => {
    expect(swatchCount(cardAt('colors-signal.html'), '--signal-')).toBe(
      tokens.filter((token) => /^--signal-\d+$/.test(token.name)).length,
    );
    expect(swatchCount(cardAt('colors-anchor.html'), '--anchor-')).toBe(
      tokens.filter((token) => /^--anchor-\d+$/.test(token.name)).length,
    );
  });

  it('keeps semantic aliases out of the anchor ramp', () => {
    // --anchor-hover / -press / -fg / -tint share the prefix but are not steps.
    const html = cardAt('colors-anchor.html');
    for (const alias of ['--anchor-hover', '--anchor-press', '--anchor-fg', '--anchor-tint']) {
      expect(html).not.toContain(`var(${alias})`);
    }
    expect(html).toContain('var(--anchor-500)');
  });

  it('renders all four status colours', () => {
    const html = cardAt('colors-status.html');
    expect(chipCount(html)).toBe(4);
    for (const name of ['--status-success', '--status-warning', '--status-danger', '--status-info'])
      expect(html).toContain(`var(${name})`);
  });

  it('renders every semantic surface and border', () => {
    const html = cardAt('colors-surfaces.html');
    expect(chipCount(html)).toBe(8);
    expect(html).toContain('var(--surface-3)');
    expect(html).toContain('var(--border-strong)');
  });

  it('renders every text colour, link hover included', () => {
    const html = cardAt('colors-text.html');
    expect((html.match(/<span style="color:var\(/g) ?? []).length).toBe(5);
    expect(html).toContain('var(--link-hover)');
  });

  it('throws naming every missing token rather than rendering a short card', () => {
    // Silently dropping is the ink bug; a rename must fail where it happens.
    expect(() => buildGuidelineCards(without('--status-danger', '--status-info'))).toThrow(
      /colors-status\.html names --status-danger, --status-info/,
    );
    expect(() => buildGuidelineCards(without('--link-hover'))).toThrow(
      /colors-text\.html names --link-hover/,
    );
  });

  it('renders every radius and weight', () => {
    expect(swatchCount(cardAt('radii.html'), '--radius-')).toBe(
      tokens.filter((token) => token.name.startsWith('--radius-')).length,
    );
    expect(swatchCount(cardAt('type-weights.html'), '--fw-')).toBe(
      tokens.filter((token) => token.name.startsWith('--fw-')).length,
    );
  });
});

describe('editorial judgement that survives generation', () => {
  it('keeps the focus ring out of the elevation ramp', () => {
    // --shadow-focus is a ring, not an elevation; in the ramp it reads as a bug.
    const html = cardAt('shadows.html');
    expect(html).toContain('var(--shadow-lg)');
    expect(html).not.toContain('var(--shadow-focus)');
  });

  it('omits the zero step from the spacing ramp', () => {
    expect(cardAt('spacing-scale.html')).not.toContain('var(--space-0)');
    expect(cardAt('spacing-scale.html')).toContain('var(--space-15)');
  });

  it('borders the near-white chips so they stay visible', () => {
    expect(cardAt('colors-ink.html')).toContain('border:1px solid var(--border)');
    expect(cardAt('colors-signal.html')).not.toContain('border:1px solid var(--border)');
  });
});

describe('the card shell', () => {
  it('opens with the @dsCard marker the pane indexes on', () => {
    for (const { html } of cards) {
      expect(html.startsWith('<!-- @dsCard group="')).toBe(true);
      expect(html).toMatch(/viewport="\d+x\d+"/);
    }
  });

  it('escapes the ampersand in a card name', () => {
    // A raw & in an HTML comment attribute is what broke the pane's parse.
    for (const { html } of cards) {
      const marker = html.slice(0, html.indexOf('-->'));
      expect(marker).not.toMatch(/&(?!amp;|quot;)/);
    }
  });

  it('links the aggregate stylesheet, not individual sheets', () => {
    for (const { html } of cards) {
      expect(html).toContain('href="../styles.css"');
    }
  });

  it('refuses to generate without tokens', () => {
    expect(() => buildGuidelineCards([])).toThrow(/no tokens/);
  });
});
