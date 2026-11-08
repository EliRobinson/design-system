/* The UI kits render the real components (#321).
 *
 * Three things have to stay true for that: the bundle the kits load holds every
 * @elirobinson/react export under the name the kits read; every kit page loads it;
 * and no kit file defines a component of its own under a name the package exports,
 * which is what a hand-made look-alike looks like. The artifact copy of the kits is
 * checked too, because its pages are rewritten to the artifact's stylesheets.
 *
 * Reads @elirobinson/react's dist, which this package's devDependency builds first.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readBundleHeader } from './design-system-artifact/bundle.mjs';
import { artifactKitFiles, artifactKitPage } from './design-system-artifact/kits.mjs';
import { KIT_BUNDLE_FILES, KIT_GLOBAL, buildKitBundle } from './kit-bundle.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const kitsDir = join(repoRoot, 'design-system-docs/ui_kits');
const manifest = JSON.parse(
  readFileSync(createRequire(import.meta.url).resolve('@elirobinson/react/manifest'), 'utf8'),
);
const exported = new Set(manifest.components.flatMap((component) => component.exports));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const kitFiles = walk(kitsDir).map((path) => ({
  file: relative(kitsDir, path).split('\\').join('/'),
  source: readFileSync(path, 'utf8'),
}));
const pages = kitFiles.filter(({ file }) => file.endsWith('/index.html'));

describe('the kit bundle', async () => {
  const { js, css } = await buildKitBundle();

  it('puts every published component on window.DesignSystem', () => {
    const header = readBundleHeader(js);
    expect(header.namespace).toBe(KIT_GLOBAL);
    expect(header.components.map((component) => component.name)).toEqual(
      manifest.components.map((component) => component.name),
    );
    expect(js.slice(js.indexOf('\n') + 1).startsWith(`window.${KIT_GLOBAL}=`)).toBe(true);
  });

  /* The artifact's own bundle carries components that exist only there. The kits are
     shipped everywhere, so they may use only what the package publishes. */
  it('holds no artifact-only component', () => {
    const names = readBundleHeader(js).components.map((component) => component.name);
    expect(names).not.toContain('ChatComposer');
    expect(names).not.toContain('PromptSuggestions');
  });

  it("styles the components and leaves the tokens to the page's own stylesheet", () => {
    expect(css).toContain('.ds-button');
    expect(css).not.toContain('@import');
    expect(css).not.toMatch(/^:root\s*\{/m);
  });
});

describe('every kit page', () => {
  it('finds the four kits', () => {
    expect(pages.map(({ file }) => file).sort()).toEqual([
      'docs/index.html',
      'marketing/index.html',
      'mobile/index.html',
      'webapp/index.html',
    ]);
  });

  it.each(pages)('$file loads the tokens, then the bundle', ({ source }) => {
    const tokens = source.indexOf('href="../../colors_and_type.css"');
    const css = source.indexOf(`href="../_shared/${KIT_BUNDLE_FILES.css}"`);
    const react = source.indexOf('react-dom@');
    const js = source.indexOf(`src="../_shared/${KIT_BUNDLE_FILES.js}"`);
    expect(tokens).toBeGreaterThan(-1);
    expect(css).toBeGreaterThan(tokens);
    /* The bundle reads React from window, so React loads first. */
    expect(js).toBeGreaterThan(react);
  });
});

/* A kit that draws its own Button is the look-alike #321 removed. Compositions with
   names of their own (AppShell, PhoneFrame, Wordmark) are what a kit is for. */
describe('no kit file redefines a component the package exports', () => {
  const scripts = kitFiles.filter(({ file }) => /\.jsx$|\.html$/.test(file));
  it.each(scripts)('$file', ({ source }) => {
    const defined = [...source.matchAll(/^\s*(?:function|const) ([A-Z][A-Za-z0-9]*)\s*[=(]/gm)].map(
      (match) => match[1],
    );
    expect(defined.filter((name) => exported.has(name))).toEqual([]);
  });
});

describe('the kits in the Design System artifact', async () => {
  const files = await artifactKitFiles(repoRoot);

  it('copies every kit file, and adds the bundle script', () => {
    const expected = [
      ...kitFiles.map(({ file }) => `ui_kits/${file}`),
      `ui_kits/_shared/${KIT_BUNDLE_FILES.js}`,
    ].sort();
    expect([...files.keys()].sort()).toEqual(expected);
  });

  it("points each page at the artifact's tokens.css and components/bundle.css", () => {
    for (const { file } of pages) {
      const html = files.get(`ui_kits/${file}`);
      expect(html).toContain('<link rel="stylesheet" href="../../tokens.css">');
      expect(html).toContain('<link rel="stylesheet" href="../../components/bundle.css">');
      expect(html).not.toContain('colors_and_type.css');
      expect(html).toContain(`src="../_shared/${KIT_BUNDLE_FILES.js}"`);
    }
  });

  it('refuses a page whose stylesheet link it cannot find', () => {
    expect(() => artifactKitPage('<html></html>', 'blank.html')).toThrow(/blank\.html has no/);
  });
});
