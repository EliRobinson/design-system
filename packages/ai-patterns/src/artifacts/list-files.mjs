import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Every file under `dir`, as sorted forward-slash paths relative to it. */
export function listFiles(dir, base = dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(path, base));
    else found.push(relative(base, path).split(sep).join('/'));
  }
  return found.sort();
}
