import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseTokensCss } from './parse-tokens-css.mjs';
import { buildTokensJson, serializeTokensJson, tokenPath } from './tokens-json.mjs';

const srcDir = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(join(srcDir, 'tokens.css'), 'utf8');
const committedJson = readFileSync(join(srcDir, 'tokens.json'), 'utf8');

/** Every leaf path in a nested object, as `a.b.c`. */
function leaves(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) =>
    child !== null && typeof child === 'object'
      ? leaves(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('the committed tokens.json', () => {
  it('is exactly what the generator produces from tokens.css', () => {
    // If this fails, someone hand-edited tokens.json (or edited tokens.css
    // without rebuilding). Run `pnpm --filter @elirobinson/tokens build`.
    expect(committedJson).toBe(serializeTokensJson(tokensCss));
  });
});

describe('coverage', () => {
  /* The regression test for the bug this generator replaces: tokens.json was
     hand-maintained and had lost --signal-200/300/400/600/800/900 and
     --anchor-200/300/400/600/800/900 without saying so. */
  it('carries a value for every :root custom property in tokens.css', () => {
    const json = buildTokensJson(tokensCss);

    for (const name of new Set(parseTokensCss(tokensCss).map((token) => token.name))) {
      const path = tokenPath(name);
      expect(path, `${name} has no rule in GROUPS`).not.toBeNull();
      expect(at(json, path), `${name} at ${path?.join('.')}`).toBe(lastDeclaration(name).value);
    }
  });

  it('maps every :root custom property to its own leaf', () => {
    const declared = new Set(parseTokensCss(tokensCss).map((token) => token.name));
    // 6 derived summaries (brand.accent/anchor, three font families, baseSize)
    // sit alongside the one-leaf-per-property mapping.
    expect(leaves(buildTokensJson(tokensCss))).toHaveLength(declared.size + 6);
  });

  it('fails loudly, naming the token, when a new custom property has no rule', () => {
    const withNewToken = tokensCss.replace(':root {', ':root {\n  --brand-new-thing: 1px;');
    expect(() => buildTokensJson(withNewToken)).toThrow(/--brand-new-thing/);
  });

  it('fails loudly when a token a derived entry reads from is removed', () => {
    const withoutFontSans = tokensCss.replace(/[ \t]*--font-sans:[^;]+;\n/, '');
    expect(withoutFontSans).not.toContain('--font-sans:');
    expect(() => buildTokensJson(withoutFontSans)).toThrow(/typography.fontSans from --font-sans/);
  });
});

describe('shape', () => {
  const json = buildTokensJson(tokensCss);

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
    expect(Object.keys(json.color)).toEqual(['ink', 'signal', 'anchor', 'semantic']);
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
    expect(json.color.semantic.success).toBe('var(--anchor-500)');
    expect(json.color.semantic.focusRing).toBe('var(--ink-1000)');
  });

  it('applies CSS last-declaration-wins to re-pointed tokens', () => {
    // --status-success is declared in the base scale and then re-pointed at
    // --anchor-500 in the semantic section.
    expect(json.color.semantic.success).not.toBe('oklch(62% 0.16 155)');
  });

  it('summarizes each font stack by its primary family', () => {
    expect(json.typography.fontSans).toBe('Geist');
    expect(json.typography.fontMono).toBe('JetBrains Mono');
    expect(json.typography.fontStack.sans).toContain('ui-sans-serif');
  });

  it('resolves the brand colors so a reader gets a color, not a var()', () => {
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
    expect(() => buildTokensJson('.thing { color: red; }')).toThrow(/tokens.css/);
  });
});

function at(value, path) {
  return path?.reduce((node, key) => node?.[key], value);
}

function lastDeclaration(name) {
  return parseTokensCss(tokensCss)
    .filter((token) => token.name === name)
    .at(-1);
}
