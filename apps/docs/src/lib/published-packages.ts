/* What this repo actually publishes, read from the package manifests rather
   than stated — a packages/<name>/package.json that carries a publishConfig
   and is not private is exactly what release.yml publishes. Server-side only:
   runs at build time, where the workspace is present. */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = join(process.cwd(), '../../packages');

export function publishedPackages(): string[] {
  return readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifest = JSON.parse(
        readFileSync(join(PACKAGES_DIR, entry.name, 'package.json'), 'utf8'),
      ) as { name: string; private?: boolean; publishConfig?: unknown };
      return manifest;
    })
    .filter((manifest) => !manifest.private && manifest.publishConfig !== undefined)
    .map((manifest) => manifest.name);
}
