/* PRODUCT.md cites repo files and `ds` subcommands. Prose that names a thing nothing
 * checks goes stale the day the thing moves, so every citation is looked up here (#325).
 *
 *   - Every backticked token that looks like a repo path must exist.
 *   - Every `ds <command>` must be a command the CLI exports from cli/commands.mjs.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as commands from '../cli/commands.mjs';
import pkg from '../../package.json' with { type: 'json' };
import { repoRoot } from './published-files.test-helper.mjs';

const listedCommands = new Set(
  [...commands.usage().text.matchAll(/^ {2}([a-z][\w-]*)\s{2,}/gm)].map((match) => match[1]),
);

const binaries = new Set(Object.keys(pkg.bin));

const doc = readFileSync(join(repoRoot, 'PRODUCT.md'), 'utf8');
const spans = [...doc.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);

/* Backticked text with a slash or a file extension that is NOT a path in this repo:
   a package specifier (`@elirobinson/...`) is out of scope here, and an upstream repo is not ours. If a new
   citation fails as a missing path but is really an external name, add it here. */
const NOT_REPO_PATHS = new Set(['vercel/ai-elements']);

const isRepoPath = (span) =>
  !/\s/.test(span) &&
  !span.includes('://') &&
  !span.includes('*') &&
  !span.startsWith('@') &&
  !NOT_REPO_PATHS.has(span) &&
  (span.includes('/') || /\.[a-z]+$/.test(span));

const paths = [...new Set(spans.filter(isRepoPath))];
const cited = [...new Set(spans.flatMap((span) => span.match(/^ds-[\w-]+$/) ?? []))];
const dsCommands = [
  ...new Set(
    spans.flatMap((span) =>
      [...span.matchAll(/(?:^|\s)(?:elirobinson-)?ds ([a-z][\w-]*)/g)].map((m) => m[1]),
    ),
  ),
];

describe('PRODUCT.md citations', () => {
  it('cites at least one path and one ds command, so the scan is not vacuous', () => {
    expect(paths.length).toBeGreaterThan(0);
    expect(dsCommands.length).toBeGreaterThan(0);
  });

  it.each(paths)('path %s exists', (path) => {
    expect(existsSync(join(repoRoot, path))).toBe(true);
  });

  it('reads the command list out of the usage text', () => {
    expect(listedCommands).toContain('dials');
    expect(listedCommands).not.toContain('usage');
  });

  it.each(dsCommands)('ds %s is a command in cli/commands.mjs usage', (name) => {
    expect(listedCommands).toContain(name);
  });

  it.each(cited)('%s is a bin of this package', (name) => {
    expect(binaries).toContain(name);
  });
});
