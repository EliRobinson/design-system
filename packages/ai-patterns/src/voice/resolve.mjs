/* Which voice pack is in force.
 *
 * A consumer's own pack wins; the shipped Miltinson pack is the fallback and is always
 * labelled as such. Never an error for the consumer who has declared nothing — an empty
 * schema would be a real regression in what the tarball is worth, and the palette dial
 * does not behave that way either.
 *
 * A malformed consumer pack throws rather than falling back. Getting someone else's
 * voice silently is the defect this layer exists to close.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePack } from './schema.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/* Where the default pack is looked for, in order. The order is the whole point.
 *
 * `package.json`'s `files` is ['src', 'dist', …], so `design-system-docs/` is never
 * published: the source-tree path resolves happily in this repo and to nothing at all in
 * a consumer's node_modules. Preferring it would make `resolveVoicePack` throw for every
 * consumer while every test here stayed green. PR 2 put the pack in `BRAND_SOURCES` so
 * the packed copy exists to be found.
 *
 * The source tree stays as the fallback rather than being dropped, because in-repo
 * callers run before `dist/` exists — the build that produces it renders this pack. */
export const DEFAULT_PACK_CANDIDATES = [
  join(here, '..', '..', 'dist', 'artifacts', 'skills', 'miltinson-design', 'miltinson.voice.json'),
  join(here, '..', '..', '..', '..', 'design-system-docs', 'miltinson.voice.json'),
];

/** The pack this system ships. Its values are one consumer's; its slot is the system's. */
export const DEFAULT_PACK_PATH =
  DEFAULT_PACK_CANDIDATES.find((candidate) => existsSync(candidate)) ?? DEFAULT_PACK_CANDIDATES[0];

/** The filename a consumer declares by creating. Presence is the declaration. */
export const CONSUMER_PACK_FILE = 'voice.json';

/** The starter a consumer copies with `ds init --voice`. Schema shape, nobody's values. */
export const STARTER_PACK_PATH = join(here, 'starter.voice.json');

/**
 * @param {{cwd?: string}} [options]
 * @returns {{pack: object, source: 'consumer'|'default', path: string}}
 */
export function resolveVoicePack({ cwd = process.cwd() } = {}) {
  const declared = join(cwd, CONSUMER_PACK_FILE);

  if (existsSync(declared)) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(declared, 'utf8'));
    } catch (cause) {
      throw new Error(`${CONSUMER_PACK_FILE} is not valid JSON: ${cause.message}`, { cause });
    }

    try {
      return { pack: validatePack(parsed), source: 'consumer', path: declared };
    } catch (cause) {
      throw new Error(`${CONSUMER_PACK_FILE} is not a valid voice pack: ${cause.message}`, {
        cause,
      });
    }
  }

  const pack = JSON.parse(readFileSync(DEFAULT_PACK_PATH, 'utf8'));
  return { pack: validatePack(pack), source: 'default', path: DEFAULT_PACK_PATH };
}
