#!/usr/bin/env node
/* The real components, built for the UI kits in design-system-docs/ui_kits/.
 *
 *   node scripts/kit-bundle.mjs <dir>
 *
 * Writes <dir>/ds-bundle.js and <dir>/ds-bundle.css. The kits load both from
 * `../_shared/`, so <dir> is a copy of ui_kits/_shared/.
 *
 * ds-bundle.js is every @elirobinson/react component as one classic script on
 * window.DesignSystem, the same build the Design System artifact's bundle.js
 * uses (design-system-artifact/bundle.mjs). It reads React from window.React,
 * which the kits load first. ds-bundle.css is react's component stylesheets,
 * inlined; the kits load the tokens themselves, before it.
 *
 * Nothing commits these two files. Every place the kits are served writes them
 * next to the kits it copies: the brand skill (build-artifacts.mjs), the docs
 * site (apps/docs/scripts/stage-brand.mjs) and the Design System artifact
 * (build-design-system-artifact.mjs). They come from react's dist/, so react
 * must be built first.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBundleJs } from './design-system-artifact/bundle.mjs';
import { reactComponentCss } from './design-system-artifact/stylesheet.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/* The global the kits read their components from. Not the artifact's
   namespace: that one carries a brand name, and kit files outside
   _shared/content.js may not (ui-kit-content.test.mjs). */
export const KIT_GLOBAL = 'DesignSystem';

export const KIT_BUNDLE_FILES = { js: 'ds-bundle.js', css: 'ds-bundle.css' };

function reactManifest() {
  const require = createRequire(import.meta.url);
  let path;
  try {
    path = require.resolve('@elirobinson/react/manifest');
  } catch {
    throw new Error(
      'kit-bundle: @elirobinson/react has no dist/manifest.json. Run `pnpm nx run react:build` first.',
    );
  }
  return { manifest: JSON.parse(readFileSync(path, 'utf8')), reactDist: dirname(path) };
}

/** The two files, as text. */
export async function buildKitBundle() {
  const { manifest, reactDist } = reactManifest();
  const { js } = await buildBundleJs({ manifest, reactDist, namespace: KIT_GLOBAL });
  const css =
    `/* @elirobinson/react ${manifest.version} component stylesheets for the UI kits. ` +
    'Load the tokens (colors_and_type.css) before this file. */\n\n' +
    `${reactComponentCss(repoRoot)}\n`;
  return { js, css };
}

/** Writes both files into `dir` and returns their paths. */
export async function writeKitBundle(dir) {
  const { js, css } = await buildKitBundle();
  mkdirSync(dir, { recursive: true });
  const paths = { js: join(dir, KIT_BUNDLE_FILES.js), css: join(dir, KIT_BUNDLE_FILES.css) };
  writeFileSync(paths.js, js);
  writeFileSync(paths.css, css);
  return paths;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('usage: node scripts/kit-bundle.mjs <dir>\n');
    process.exit(1);
  }
  writeKitBundle(resolve(process.env.INIT_CWD ?? process.cwd(), dir)).then(
    (paths) => process.stdout.write(`kit-bundle: wrote ${paths.js} and ${paths.css}\n`),
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    },
  );
}
