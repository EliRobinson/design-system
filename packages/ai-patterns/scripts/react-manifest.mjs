/* @elirobinson/react's manifest and the dist/ folder beside it, resolved through the
 * package's exports map, so a build reads exactly what a consumer would. It is a build
 * output of that package, so react must be built first. */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

/** `{ manifest, reactDist }`. Throws naming the build to run when dist/ is missing. */
export function reactManifest() {
  let path;
  try {
    path = createRequire(import.meta.url).resolve('@elirobinson/react/manifest');
  } catch (error) {
    throw new Error(
      'Cannot resolve @elirobinson/react/manifest. Build that package first: pnpm nx run react:build.',
      { cause: error },
    );
  }
  return { manifest: JSON.parse(readFileSync(path, 'utf8')), reactDist: dirname(path) };
}
