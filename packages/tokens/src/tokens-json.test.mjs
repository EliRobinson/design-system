import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseTokensCss } from './parse-tokens-css.mjs';
import { readTokenStylesheets, TOKENS_SRC_DIR } from './token-stylesheets.mjs';
import { buildTokensJson, serializeTokensJson, tokenPath } from './tokens-json.mjs';

/* Both token stylesheets, in cascade order, because half the vocabulary is in
   palettes.css — reading tokens.css alone here would quietly narrow every
   coverage assertion below to the file that happens to hold the neutrals. */
const stylesheets = readTokenStylesheets();
const [palettesCss, tokensCss] = stylesheets;
const committedJson = readFileSync(join(TOKENS_SRC_DIR, 'tokens.json'), 'utf8');

/** Every leaf path in a nested object, as `a.b.c`. */
function leaves(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) =>
    child !== null && typeof child === 'object'
      ? leaves(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('the committed tokens.json', () => {
  it('is exactly what the generator produces from the token stylesheets', () => {
    // If this fails, someone hand-edited tokens.json (or edited a stylesheet
    // without rebuilding). Run `pnpm --filter @elirobinson/tokens build`.
    expect(committedJson).toBe(serializeTokensJson(stylesheets));
  });
});

describe('coverage', () => {
  /* The regression test for the bug this generator replaces: tokens.json was
     hand-maintained and had lost --signal-200/300/400/600/800/900 and
     --anchor-200/300/400/600/800/900 without saying so. */
  it('carries a value for every :root custom property in the token stylesheets', () => {
    const json = buildTokensJson(stylesheets);

    for (const name of new Set(parseTokensCss(stylesheets).map((token) => token.name))) {
      const path = tokenPath(name);
      expect(path, `${name} has no rule in GROUPS`).not.toBeNull();
      expect(at(json, path), `${name} at ${path?.join('.')}`).toBe(lastDeclaration(name).value);
    }
  });

  it('maps every :root custom property to its own leaf', () => {
    const declared = new Set(parseTokensCss(stylesheets).map((token) => token.name));
    // 6 derived summaries (brand.accent/anchor, three font families, baseSize)
    // sit alongside the one-leaf-per-property mapping.
    expect(leaves(buildTokensJson(stylesheets))).toHaveLength(declared.size + 6);
  });

  it('fails loudly, naming the token, when a new custom property has no rule', () => {
    const withNewToken = [
      palettesCss.replace(':root {', ':root {\n  --brand-new-thing: 1px;'),
      tokensCss,
    ];
    expect(() => buildTokensJson(withNewToken)).toThrow(/--brand-new-thing/);
  });

  it('fails loudly when a token a derived entry reads from is removed', () => {
    const withoutFontSans = tokensCss.replace(/[ \t]*--font-sans:[^;]+;\n/, '');
    expect(withoutFontSans).not.toContain('--font-sans:');
    expect(() => buildTokensJson([palettesCss, withoutFontSans])).toThrow(
      /typography.fontSans from --font-sans/,
    );
  });

  /* The palette split's own failure mode, pinned. tokens.css alone still parses
     and still yields 125 declarations, so nothing about the *shape* of the
     result says the brand is missing — the DERIVED check is the only thing
     standing between that and a committed tokens.json with no accent in it. */
  it('fails loudly, and points at the missing stylesheet, when only tokens.css is passed', () => {
    expect(() => buildTokensJson(tokensCss)).toThrow(/brand.accent from --accent/);
    expect(() => buildTokensJson(tokensCss)).toThrow(/readTokenStylesheets/);
  });
});

describe('shape', () => {
  const json = buildTokensJson(stylesheets);

  it('keeps the nested shape tokens-data consumers import', () => {
    expect(Object.keys(json)).toEqual([
      'brand',
      'color',
      'typography',
      'radius',
      'space',
      'shadow',
      'motion',
      'layout',
    ]);
    // Source order across the two files: palettes.css declares the neutral
    // dials, the two ramps, the semantics and the chart ramp; tokens.css then
    // declares the ink scale those dials mix.
    expect(Object.keys(json.color)).toEqual([
      'neutral',
      'signal',
      'anchor',
      'semantic',
      'chart',
      'ink',
    ]);
  });

  it('groups the numeric scales, not the semantic aliases that share a prefix', () => {
    expect(json.color.anchor['500']).toBe('oklch(42% 0.08 156)');
    expect(json.color.semantic.anchor).toBe('var(--anchor-500)');
    expect(json.color.anchor.hover).toBeUndefined();
  });

  it('keeps the semantic key names that predate the generator', () => {
    expect(json.color.semantic.fgSecondary).toBe('var(--ink-600)');
    expect(json.color.semantic.fgTertiary).toBe('var(--ink-500)');
    expect(json.color.semantic.fgDisabled).toBe('var(--ink-400)');
    expect(json.color.semantic.success).toBe('oklch(51.9% 0.145 150)');
    expect(json.color.semantic.focusRing).toBe('var(--ink-1000)');
  });

  it('keeps every member of a status set in one flat semantic bag', () => {
    // -fg and -tint are published keys; -on, -tint-edge and -border joined them
    // when the platform layer landed. All five drop the `status` prefix, so the
    // members of a set sort together for a reader scanning the file.
    expect(json.color.semantic.successOn).toBeTruthy();
    expect(json.color.semantic.successFg).toBeTruthy();
    expect(json.color.semantic.successTint).toBeTruthy();
    expect(json.color.semantic.successTintEdge).toBeTruthy();
    expect(json.color.semantic.warningBorder).toBeTruthy();
  });

  it('gives the chart ramp its own group so a consumer can iterate the series', () => {
    // The eight series are the point: a chart picks colour N of 8. They cannot
    // live in color.semantic, where iterating means knowing which of forty
    // members to skip. grid and axis ride along because they are chart colours
    // that are not a series, and nowhere else is more honest.
    expect(Object.keys(json.color.chart)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      'grid',
      'axis',
    ]);
    expect(json.color.chart['1']).toBe('oklch(62% 0.13 25)');
    expect(json.color.chart.grid).toBe('var(--border-strong)');
  });

  it('files hit areas and safe-area insets as layout, next to the containers', () => {
    // They name controls but they are lengths a component reads for min-height
    // and padding, exactly as --gutter is.
    expect(json.layout.target).toBe('44px');
    expect(json.layout.targetMin).toBe('24px');
    expect(json.layout.safeB).toBe('env(safe-area-inset-bottom, 0px)');
  });

  it('exposes the neutral dials, so a reader can see what mixes the greys', () => {
    // Every --ink-* step is oklch(<L>% calc(<C> * mult) h). Without these two
    // in the JSON the ink scale reads as an unexplained calc().
    expect(json.color.neutral).toEqual({ h: '247', mult: '1' });
  });

  it('applies CSS last-declaration-wins across the stylesheets, in cascade order', () => {
    /* No token is declared twice in the shipped files any more — the palette
       split gave each name exactly one home — so the rule is pinned on a
       fixture instead of on a duplication we would then have to preserve. What
       matters is the direction: sources are passed @imported-file-first, so the
       LATER argument wins, which is what a browser does with tokens.css's own
       `:root` sitting below its @imports. */
    const patched = buildTokensJson([...stylesheets, ':root {\n  --gutter: 99px;\n}']);
    expect(json.layout.gutter).not.toBe('99px');
    expect(patched.layout.gutter).toBe('99px');
  });

  it('summarizes each font stack by its primary family', () => {
    expect(json.typography.fontSans).toBe('Geist');
    expect(json.typography.fontMono).toBe('JetBrains Mono');
    expect(json.typography.fontStack.sans).toContain('ui-sans-serif');
  });

  it('resolves the brand colors so a reader gets a color, not a var()', () => {
    // --accent is var(--signal-500) in palettes.css; resolving it needs both
    // files, which is the whole reason this suite reads the roster.
    expect(json.brand.accent).toBe('oklch(72.5% 0.175 65)');
    expect(json.brand.anchor).toBe('oklch(42% 0.08 156)');
  });

  it('carries the scale steps the hand-written file was missing', () => {
    for (const step of ['200', '300', '400', '600', '800', '900']) {
      expect(json.color.signal[step], `signal-${step}`).toBeTruthy();
      expect(json.color.anchor[step], `anchor-${step}`).toBeTruthy();
    }
  });

  it('rejects a stylesheet with no :root block instead of writing an empty file', () => {
    expect(() => buildTokensJson('.thing { color: red; }')).toThrow(/token stylesheets/);
  });
});

function at(value, path) {
  return path?.reduce((node, key) => node?.[key], value);
}

function lastDeclaration(name) {
  return parseTokensCss(stylesheets)
    .filter((token) => token.name === name)
    .at(-1);
}
