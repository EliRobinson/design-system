/* The UI kits render the real components (#321).
 *
 * Three things have to stay true for that: the bundle the kits load holds every
 * @elirobinson/react export under the name the kits read; every kit page loads it;
 * and no kit file defines a component of its own under a name the package exports,
 * which is what a hand-made look-alike looks like. The artifact copy of the kits is
 * checked too, because its pages are rewritten to the artifact's own files.
 *
 * Reads @elirobinson/react's dist, which this package's devDependency builds first.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listFiles } from '../src/artifacts/list-files.mjs';
import { ARTIFACT_ONLY } from './design-system-artifact/artifact-only.mjs';
import { NAMESPACE, readBundleHeader } from './design-system-artifact/bundle.mjs';
import { artifactKitFiles, artifactKitPage } from './design-system-artifact/kits.mjs';
import {
  KIT_BUNDLE_FILES,
  KIT_BUNDLE_LINT_OFF,
  KIT_GLOBAL,
  buildKitBundleCss,
  buildKitBundleJs,
} from './kit-bundle.mjs';
import { reactManifest } from './react-manifest.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const kitsDir = join(repoRoot, 'design-system-docs/ui_kits');
const react = reactManifest();
const { manifest } = react;
const exported = new Set(manifest.components.flatMap((component) => component.exports));

const kitFiles = listFiles(kitsDir).map((file) => ({
  file,
  source: readFileSync(join(kitsDir, file), 'utf8'),
}));
const pages = kitFiles.filter(({ file }) => file.endsWith('/index.html'));

describe('the kit bundle', async () => {
  const js = await buildKitBundleJs(react);
  const css = buildKitBundleCss(react);

  it('puts every published component on window.DesignSystem', () => {
    const header = readBundleHeader(js);
    expect(header.namespace).toBe(KIT_GLOBAL);
    expect(header.components.map((component) => component.name)).toEqual(
      manifest.components.map((component) => component.name),
    );
    const [, lintOff, code] = js.split('\n');
    expect(lintOff).toBe(KIT_BUNDLE_LINT_OFF);
    expect(code.startsWith(`window.${KIT_GLOBAL}=`)).toBe(true);
  });

  /* The artifact's own bundle carries components that exist only there. The kits are
     shipped everywhere, so they may use only what the package publishes. */
  it('holds no artifact-only component', () => {
    const names = readBundleHeader(js).components.map((component) => component.name);
    for (const name of ARTIFACT_ONLY.names) expect(names).not.toContain(name);
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

/* A name react renames or drops would read as undefined and crash the kit at run
   time, with no lint rule to notice: the name is declared by the destructure. */
describe('every component a kit reads from window.DesignSystem is published', () => {
  const readers = kitFiles.filter(({ source }) => source.includes('} = window.DesignSystem'));
  it.each(readers)('$file', ({ source }) => {
    const read = [...source.matchAll(/const \{([^}]*)\} = window\.DesignSystem/g)].flatMap(
      ([, list]) =>
        list
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
    );
    expect(read.length).toBeGreaterThan(0);
    expect(read.filter((name) => !exported.has(name))).toEqual([]);
  });
});

describe('the kits in the Design System artifact', () => {
  const files = artifactKitFiles(repoRoot);

  it('copies every kit file and builds no second bundle', () => {
    expect([...files.keys()]).toEqual(kitFiles.map(({ file }) => `ui_kits/${file}`));
  });

  it("points each page at the artifact's tokens and bundle, under the kits' global", () => {
    for (const { file } of pages) {
      const html = files.get(`ui_kits/${file}`);
      expect(html).toContain('<link rel="stylesheet" href="../../tokens.css">');
      expect(html).toContain('<link rel="stylesheet" href="../../components/bundle.css">');
      expect(html).toContain('<script src="../../components/bundle.js"></script>');
      expect(html).toContain(`<script>window.${KIT_GLOBAL} = window.${NAMESPACE};</script>`);
      expect(html).not.toContain('colors_and_type.css');
      expect(html).not.toContain(KIT_BUNDLE_FILES.js);
    }
  });

  it('refuses a page whose stylesheet link it cannot find', () => {
    expect(() => artifactKitPage('<html></html>', 'blank.html')).toThrow(/blank\.html has no/);
  });
});
