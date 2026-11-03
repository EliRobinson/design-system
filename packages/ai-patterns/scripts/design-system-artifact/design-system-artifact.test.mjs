/* The Design System artifact build: the token count per theme, the bundle
 * header, and the round trip of the artifact-owned parts.
 *
 * The bundle test reads @elirobinson/react's dist, which this package's
 * devDependency on it builds first. */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { NAMESPACE, buildBundleJs, readBundleHeader } from './bundle.mjs';
import { checkLimits } from './limits.mjs';
import { buildBundleCss, previousSection } from './stylesheet.mjs';
import { THEMES, buildTokens, resolveThemes } from './tokens.mjs';
import { previousTypesSection } from './types.mjs';

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
  block(`:root, [data-theme="${THEMES[0]}"]`);
  if (theme !== THEMES[0]) block(`[data-theme="${theme}"]`);
  return declared;
}

describe('tokens', () => {
  const { json, css, report } = buildTokens({ srcDir: tokensSrc, meta });
  const colours = json.color.tokens;

  it('has the 8 themes, in order, with slate left out', () => {
    expect(json.color.themes.map((theme) => theme.id)).toEqual(THEMES);
    expect(THEMES).toHaveLength(8);
    expect(json.meta.themesLeftOut).toEqual(['palette-slate', 'palette-slate-dark']);
  });

  it('places every colour the repo declares, so no theme silently loses one', () => {
    expect(report.notPlaced).toEqual([]);
    const { resolved } = resolveThemes(tokensSrc);
    const colourNames = colours.map((token) => token.name);
    /* Every colour token in tokens.json is declared in every theme of the repo. */
    for (const theme of THEMES) {
      for (const name of colourNames)
        expect(resolved[theme].has(`--${name}`), `${theme} --${name}`).toBe(true);
    }
  });

  it.each(THEMES)('gives every colour token a value in %s', (theme) => {
    const valued = colours.filter((token) =>
      typeof token.value === 'string' ? token.value : token.value[theme],
    );
    expect(valued).toHaveLength(colours.length);
    expect(colours.length).toBeGreaterThan(100);
  });

  it.each(THEMES)('compiles tokens.css so %s declares every colour and shadow', (theme) => {
    const declared = declaredFor(css, theme);
    const shadows = json.shadow.tokens.map((token) => token.name);
    for (const name of [...colours.map((token) => token.name), ...shadows]) {
      expect(declared.has(name), `--${name} in ${theme}`).toBe(true);
    }
    expect(declared.size).toBe(colours.length + shadows.length);
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

  it('fits the artifact caps', () => {
    expect(() => checkLimits({ tokensJson: json, sizes: { 'tokens.json': 1 } })).not.toThrow();
    expect(() =>
      checkLimits({ tokensJson: { color: { themes: Array(9), tokens: [] } }, sizes: {} }),
    ).toThrow(/9 themes/);
  });
});

/* Two stand-ins for the artifact-only components, so the test does not read the artifact. */
function previousDir() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-artifact-'));
  const ai = join(dir, 'components/src/components/ai');
  mkdirSync(ai, { recursive: true });
  for (const name of ['ChatComposer', 'PromptSuggestions']) {
    writeFileSync(
      join(ai, `${name}.jsx`),
      `export function ${name}() { return <div className="x" />; }\n`,
    );
  }
  return dir;
}

describe('bundle.js', async () => {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve('@elirobinson/react/manifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { js } = await buildBundleJs({
    manifest,
    reactDist: dirname(manifestPath),
    previousDir: previousDir(),
  });
  const header = readBundleHeader(js);

  it('opens with the header the artifact reads', () => {
    expect(header).toMatchObject({ format: 4, namespace: NAMESPACE });
    expect(NAMESPACE).toBe('MiltinsonDesignSystem_e160cb');
  });

  it('lists every published component, with the two artifact-only ones after StreamingCaret', () => {
    const names = header.components.map((component) => component.name);
    const published = manifest.components.map((component) => component.name);
    const caret = published.indexOf('StreamingCaret');
    expect(names).toEqual([
      ...published.slice(0, caret + 1),
      'ChatComposer',
      'PromptSuggestions',
      ...published.slice(caret + 1),
    ]);
  });

  it('is one classic script that assigns the namespace and reads React from window', () => {
    const body = js.slice(js.indexOf('\n') + 1);
    expect(body.startsWith(`window.${NAMESPACE}=`)).toBe(true);
    expect(body).toContain('window.React');
    expect(body).not.toMatch(/<\/script|<!--/i);
    expect(body).not.toMatch(/\brequire\(["']react/);
    expect(body).not.toMatch(/^import |\bimport\(/m);
  });
});

describe('bundle.css', () => {
  const carried = (path, rule) => `/* ── ${path} (previous artifact bundle) ── */\n${rule}\n`;
  const previous =
    carried('components/ai/ChatComposer.css', '.ds-chat-composer { color: red; }') +
    '\n' +
    carried('components/ai/PromptSuggestions.css', '.ds-chat-suggestions { color: blue; }') +
    '\n/* Scoped palettes, from palettes.css */\n[data-palette="x"] {}\n';
  const out = buildBundleCss({
    repoRoot,
    extrasCss: ':root { --gutter: 1px; }\n',
    previousBundleCss: previous,
    reactVersion: '0.0.0',
    ref: '0000000',
  });

  it('carries the artifact-only stylesheets so the next build finds them again', () => {
    expect(previousSection(out, 'components/ai/ChatComposer.css')).toBe(
      '.ds-chat-composer { color: red; }',
    );
    expect(previousSection(out, 'components/ai/PromptSuggestions.css')).toBe(
      '.ds-chat-suggestions { color: blue; }',
    );
  });

  it('ends with the scoped palette blocks 3-10 and none of the :root blocks', () => {
    const palettes = out.slice(out.indexOf('/* Scoped palettes'));
    for (const name of ['slate', 'miltinson', 'miltinson-tech', 'steady']) {
      expect(palettes).toContain(`[data-palette='${name}'] {`);
      expect(palettes).toContain(`[data-palette='${name}'][data-theme='dark'],`);
    }
    expect(palettes).not.toMatch(/^:root\b/m);
    expect(palettes).not.toMatch(/^\[data-theme='dark'\],\s*\n?\.dark/m);
  });

  it('includes the AI Elements layers and the component stylesheets', () => {
    for (const layer of ['ai-core', 'ai-agent', 'ai-media', 'ai-canvas', 'ai-shell']) {
      expect(out).toContain(`/* ── components/ai/${layer}.css (apps/docs/src/app/ai-theme) ── */`);
    }
    expect(out).toContain('/* ── components/atoms/Button.css ── */');
  });
});

describe('index.d.ts round trip', () => {
  it('reads an artifact-only section back by name', () => {
    const index =
      '// ── A\nexport type A = 1;\n\n// ── ChatComposer\nexport interface ChatComposerProps {}\n\n// ── B\n';
    expect(previousTypesSection(index, 'ChatComposer')).toBe(
      'export interface ChatComposerProps {}',
    );
    expect(() => previousTypesSection(index, 'Missing')).toThrow(/Missing/);
  });
});
