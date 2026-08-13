/* Fails the build if any route is server-rendered.

   The site is a pure build-time projection of the packages: every page and
   route handler reads the manifest, tokens.css, and the MDX sources with
   `readFileSync` at build time, where cwd is apps/docs and the files exist.
   One page turning dynamic would move those reads into a serverless function
   where neither the workspace node_modules nor the MDX sources are traced
   into the bundle — a production-only failure. This assertion runs as part
   of `next build` everywhere the site builds (Quality CI and Vercel), so it
   fails in CI instead.

   A static route appears in prerender-manifest.json — under `routes` when
   prerendered directly, or under `dynamicRoutes` when its paths come from
   generateStaticParams. A server-rendered route appears in neither. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const nextDir = join(process.cwd(), '.next');
const read = (name) => JSON.parse(readFileSync(join(nextDir, name), 'utf8'));

const appRoutes = Object.values(read('app-path-routes-manifest.json'));
const prerender = read('prerender-manifest.json');
const prerendered = new Set([
  ...Object.keys(prerender.routes),
  ...Object.keys(prerender.dynamicRoutes),
]);

const serverRendered = appRoutes.filter((route) => !prerendered.has(route));

if (serverRendered.length > 0) {
  console.error(
    `Server-rendered routes are not allowed — every route must be static.\n` +
      `These routes are missing from prerender-manifest.json:\n` +
      serverRendered.map((route) => `  ${route}`).join('\n') +
      `\nA route goes dynamic when it (or a layout above it) reads request ` +
      `data (cookies(), headers(), searchParams) or opts out of static ` +
      `rendering. Remove the dynamic dependency or export ` +
      `\`dynamic = 'force-static'\` with generateStaticParams.`,
  );
  process.exit(1);
}

process.stdout.write(`All ${appRoutes.length} routes are statically generated.\n`);
