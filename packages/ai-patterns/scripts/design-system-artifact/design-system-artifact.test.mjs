/* The Design System artifact build: the token count and values per theme, the
 * bundle header, the types, and the round trip of the artifact-owned parts.
 *
 * The bundle and types tests read @elirobinson/react's dist, which this
 * package's devDependency on it builds first. */

import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMBINATIONS, DEFAULT_PALETTE, combinationValues } from '@elirobinson/tokens/contrast';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import { ARTIFACT_ONLY } from './artifact-only.mjs';
import { NAMESPACE, buildBundleJs, readBundleHeader } from './bundle.mjs';
import { LIMITS, checkLimits } from './limits.mjs';
import {
  AI_THEME_DIR,
  AI_THEME_ENTRY,
  aiFixups,
  aiLayers,
  buildBundleCss,
  previousSection,
} from './stylesheet.mjs';
import { ARTIFACT_THEMES, KEPT, buildTokens } from './tokens.mjs';
import { buildTypes, previousTypesSection } from './types.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../..');
const tokensSrc = join(repoRoot, 'packages/tokens/src');
const meta = { ref: 'main@0000000', synced: '2026-01-01' };

/* What the compiled tokens.css declares for one theme: the first block, then
   that theme's overrides, as the browser cascades them on <html data-theme>. */
function declaredFor(css, theme) {
  const declared = new Map();
  const block = (selector) => {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) return;
    const body = css.slice(start, css.indexOf('}', start));
    for (const match of body.matchAll(/--([\w.-]+): ([^;]+);/g)) declared.set(match[1], match[2]);
  };
  block(`:root, [data-theme="${ARTIFACT_THEMES[0]}"]`);
  if (theme !== ARTIFACT_THEMES[0]) block(`[data-theme="${theme}"]`);
  return declared;
}

/* How the build writes a value: no space inside parens, lower-case hex. */
const normalise = (value) =>
  value
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/#[0-9a-f]+/gi, (hex) => hex.toLowerCase());

describe('tokens', () => {
  const { json, css, report } = buildTokens({ srcDir: tokensSrc, previous: {}, meta });
  const colours = json.color.tokens;

  it('has one theme per kept palette × theme, at most 8, with slate left out', () => {
    expect(json.color.themes.map((theme) => theme.id)).toEqual(ARTIFACT_THEMES);
    expect(ARTIFACT_THEMES).toHaveLength(KEPT.length);
    expect(ARTIFACT_THEMES.length).toBeLessThanOrEqual(LIMITS.themes);
    expect(ARTIFACT_THEMES.slice(0, 2)).toEqual(['light', 'dark']);
    expect(json.meta.themesLeftOut).toEqual(['palette-slate', 'palette-slate-dark']);
  });

  it('places every colour the repo declares', () => {
    expect(report.notPlaced).toEqual([]);
    expect(colours.length).toBeGreaterThan(100);
  });

  /* The value check: follow tokens.json's aliases to a literal, and compare it
     with what the tokens package's own cascade resolves for that combination. */
  it.each(KEPT.map((combination, index) => [ARTIFACT_THEMES[index], combination]))(
    'gives every colour token in %s the value the tokens package resolves',
    (theme, combination) => {
      const expected = combinationValues(readTokenStylesheets(tokensSrc), combination);
      const byName = new Map(colours.map((token) => [token.name, token]));
      const literal = (name) => {
        const token = byName.get(name);
        const value = typeof token.value === 'string' ? token.value : token.value[theme];
        return value.startsWith('{') ? literal(value.slice(1, -1)) : value;
      };
      for (const token of colours) {
        expect(literal(token.name), `--${token.name}`).toBe(
          normalise(expected.get(`--${token.name}`)),
        );
      }
    },
  );

  it.each(KEPT.map((combination, index) => [ARTIFACT_THEMES[index], combination]))(
    'compiles tokens.css so %s declares every colour and shadow, at the resolved value',
    (theme, combination) => {
      const declared = declaredFor(css, theme);
      const expected = combinationValues(readTokenStylesheets(tokensSrc), combination);
      const follow = (value) =>
        value.replace(/var\(--([\w-]+)\)/g, (_, name) => follow(declared.get(name)));
      const shadows = json.shadow.tokens.map((token) => token.name);
      for (const name of [...colours.map((token) => token.name), ...shadows]) {
        expect(declared.has(name), `--${name} in ${theme}`).toBe(true);
        expect(follow(declared.get(name)), `--${name} in ${theme}`).toBe(
          normalise(expected.get(`--${name}`)),
        );
      }
      expect(declared.size).toBe(colours.length + shadows.length);
    },
  );

  it('reports a colour the artifact has and the repo no longer declares', () => {
    const previous = {
      color: { themes: [], tokens: [{ name: 'retired-colour', value: '#000', usage: '' }] },
    };
    const { report: rebuilt } = buildTokens({ srcDir: tokensSrc, previous, meta });
    expect(rebuilt.droppedColours).toEqual(['retired-colour']);
  });

  it('keeps the usage notes and the family order of the previous tokens.json', () => {
    const previous = {
      version: 1,
      color: { themes: [], tokens: [{ name: 'accent', value: '#000', usage: 'Kept note.' }] },
      radius: { tokens: [{ name: 'radius-pill', value: '1px', usage: 'Pill note.' }] },
      spacing: { tokens: [] },
    };
    const rebuilt = buildTokens({ srcDir: tokensSrc, previous, meta }).json;
    expect(rebuilt.color.tokens.find((token) => token.name === 'accent').usage).toBe('Kept note.');
    expect(rebuilt.radius.tokens[0]).toMatchObject({ name: 'radius-pill', usage: 'Pill note.' });
    expect(rebuilt.radius.tokens[0].value).not.toBe('1px');
    expect(Object.keys(rebuilt).indexOf('radius')).toBeLessThan(
      Object.keys(rebuilt).indexOf('spacing'),
    );
  });

  it('writes an aliased non-colour token as the value it resolves to', () => {
    const srcDir = join(mkdtempSync(join(tmpdir(), 'ds-tokens-')), 'src');
    cpSync(tokensSrc, srcDir, { recursive: true });
    appendFileSync(join(srcDir, 'tokens.css'), '\n:root { --radius-card: var(--radius-lg); }\n');
    const { json: aliased } = buildTokens({ srcDir, previous: {}, meta });
    const radius = new Map(aliased.radius.tokens.map((token) => [token.name, token.value]));
    expect(radius.get('radius-card')).toBe(radius.get('radius-lg'));
    expect(radius.get('radius-card')).not.toContain('var(');
  });

  it('refuses a non-colour value or a type style the artifact cannot read', () => {
    const base = { color: { themes: [], tokens: [] } };
    const radius = { tokens: [{ name: 'radius-card', value: 'var(--radius-lg)', usage: '' }] };
    expect(() => checkLimits({ tokensJson: { ...base, radius }, sizes: {} })).toThrow(
      /radius radius-card is not a literal value/,
    );
    const type = { groups: [{ styles: [{ name: 't-h1', fontSize: '1rem', fontWeight: null }] }] };
    expect(() => checkLimits({ tokensJson: { ...base, type }, sizes: {} })).toThrow(
      /t-h1 fontWeight/,
    );
    const many = {
      tokens: Array.from({ length: 61 }, (_, i) => ({ name: `r${i}`, value: '1px' })),
    };
    expect(() => checkLimits({ tokensJson: { ...base, radius: many }, sizes: {} })).toThrow(
      /61 tokens/,
    );
  });

  it('fits the artifact caps, and the cap check fails on a ninth theme', () => {
    expect(() => checkLimits({ tokensJson: json, sizes: { 'tokens.json': 1 } })).not.toThrow();
    expect(() =>
      checkLimits({ tokensJson: { color: { themes: Array(9), tokens: [] } }, sizes: {} }),
    ).toThrow(/9 themes/);
  });
});

/* Stand-ins for the artifact-only components, so the test does not read the artifact. */
function previousDir() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-artifact-'));
  for (const name of ARTIFACT_ONLY.names) {
    const file = join(dir, ARTIFACT_ONLY.source(name));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `export function ${name}() { return <div className="x" />; }\n`);
  }
  return dir;
}

const require = createRequire(import.meta.url);
const manifestPath = require.resolve('@elirobinson/react/manifest');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const reactDist = dirname(manifestPath);
const published = manifest.components.map((component) => component.name);
const caret = published.indexOf(ARTIFACT_ONLY.after);
const artifactOrder = [
  ...published.slice(0, caret + 1),
  ...ARTIFACT_ONLY.names,
  ...published.slice(caret + 1),
];

describe('bundle.js', async () => {
  const { js } = await buildBundleJs({ manifest, reactDist, previousDir: previousDir() });
  const header = readBundleHeader(js);

  it('opens with the header the artifact reads', () => {
    expect(header).toMatchObject({ format: 4, namespace: NAMESPACE });
    expect(NAMESPACE).toBe('MiltinsonDesignSystem_e160cb');
  });

  it('lists every published component, with the artifact-only ones after StreamingCaret', () => {
    expect(header.components.map((component) => component.name)).toEqual(artifactOrder);
  });

  it('is one classic script that assigns the namespace and reads React from window', () => {
    const body = js.slice(js.indexOf('\n') + 1);
    expect(body.startsWith(`window.${NAMESPACE}=`)).toBe(true);
    expect(body).toContain('window.React');
    expect(body).not.toMatch(/<\/script|<!--/i);
    expect(body).not.toMatch(/\brequire\(["']react/);
    expect(body).not.toMatch(/^import |\bimport\(/m);
    expect(Buffer.byteLength(js)).toBeLessThan(LIMITS.bytes['components/bundle.js']);
  });
});

describe('types', () => {
  const previousIndexDts = ARTIFACT_ONLY.names
    .map((name) => `// ── ${name}\nexport interface ${name}Props {}\n`)
    .join('\n');
  const { index, perComponent } = buildTypes({ manifest, reactDist, previousIndexDts });

  it('writes one section per component, in bundle order', () => {
    const sections = [...index.matchAll(/^\/\/ ── (\w+)$/gm)].map((match) => match[1]);
    expect(sections).toEqual(artifactOrder);
    expect([...perComponent.keys()]).toEqual(artifactOrder);
  });

  it('turns props into interfaces the api cards read, with no relative imports left', () => {
    expect(index).toMatch(/export interface ButtonProps extends /);
    expect(index).not.toMatch(/from '\.|import\("/);
    expect((index.match(/export type Verdict =/g) ?? []).length).toBe(1);
    expect(perComponent.get('ChatComposer')).toContain('export interface ChatComposerProps {}');
  });

  it('reads an artifact-only section back by name', () => {
    expect(previousTypesSection(previousIndexDts, 'ChatComposer')).toBe(
      'export interface ChatComposerProps {}',
    );
    expect(() => previousTypesSection(previousIndexDts, 'Missing')).toThrow(/Missing/);
  });
});

describe('bundle.css', () => {
  const carried = (path, rule) => `/* ── ${path} (previous artifact bundle) ── */\n${rule}\n`;
  const rules = ARTIFACT_ONLY.names.map((name) => `.${name} { color: red; }`);
  const previous =
    ARTIFACT_ONLY.names
      .map((name, index) => carried(ARTIFACT_ONLY.stylesheet(name), rules[index]))
      .join('\n') + '\n/* Scoped palettes, from palettes.css */\n[data-palette="x"] {}\n';
  const out = buildBundleCss({
    repoRoot,
    tokensSrc,
    extrasCss: ':root { --gutter: 1px; }\n',
    previousBundleCss: previous,
    reactVersion: '0.0.0',
    ref: '0000000',
  });

  it('ends a carried section at a marker line, not at a comment inside it', () => {
    const css = '.a {}\n/* ── a note inside the stylesheet */\n.b {}';
    const bundle = `${carried('x.css', css)}\n${carried('y.css', '.c {}')}`;
    expect(previousSection(bundle, 'x.css')).toBe(css);
  });

  it('carries the artifact-only stylesheets so the next build finds them again', () => {
    ARTIFACT_ONLY.names.forEach((name, index) => {
      expect(previousSection(out, ARTIFACT_ONLY.stylesheet(name))).toBe(rules[index]);
    });
  });

  it('ends with every scoped palette block and none of the :root blocks', () => {
    const palettes = out.slice(out.indexOf('/* Scoped palettes'));
    for (const { palette } of COMBINATIONS.filter((combination) => combination.theme === 'dark')) {
      if (palette === DEFAULT_PALETTE) continue;
      expect(palettes).toContain(`[data-palette='${palette}'] {`);
      expect(palettes).toContain(`[data-palette='${palette}'][data-theme='dark'],`);
    }
    expect(palettes).not.toMatch(/^:root\b/m);
    expect(palettes).not.toMatch(/^\[data-theme='dark'\],\s*\n?\.dark/m);
  });

  it('includes the AI Elements layers the docs app imports, and the component stylesheets', () => {
    const layers = aiLayers(readFileSync(join(repoRoot, AI_THEME_ENTRY), 'utf8'));
    expect(layers).not.toContain('ai-bridge');
    for (const layer of layers) {
      expect(out).toContain(`/* ── components/ai/${layer}.css (${AI_THEME_DIR}) ── */`);
    }
    expect(out).toContain('/* ── components/atoms/Button.css ── */');
  });

  it("carries the docs app's ai-theme fixups after the layers, so no rule reads an undeclared token", () => {
    const entryCss = readFileSync(join(repoRoot, AI_THEME_ENTRY), 'utf8');
    const fixups = aiFixups(entryCss);
    expect(fixups).toContain('ai-theme-bundler-fixups');
    const lastLayer = out.indexOf(`/* ── components/ai/${aiLayers(entryCss).at(-1)}.css`);
    for (const fixup of fixups) {
      const at = out.indexOf(`/* ── components/ai/${fixup}.css (apps/docs/src/app) ── */`);
      expect(at).toBeGreaterThan(lastLayer);
    }
    /* #352 and #358: these two leave the global tokens, and the fixups declare or replace them. */
    expect(out).toMatch(/\.ds-ai-model-list \{\s*--anchored-min-width: 180px;/);
    expect(out).toContain('var(--shell-md)');
  });
});
