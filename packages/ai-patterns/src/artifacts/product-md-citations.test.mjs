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
import { repoRoot } from './published-files.test-helper.mjs';

const doc = readFileSync(join(repoRoot, 'PRODUCT.md'), 'utf8');
const spans = [...doc.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);

/* Backticked text with a slash or a file extension that is NOT a path in this repo:
   a package specifier is checked by npm, and an upstream repo is not ours. */
const NOT_REPO_PATHS = new Set(['vercel/ai-elements']);

const isRepoPath = (span) =>
  !/\s/.test(span) &&
  !span.startsWith('@') &&
  !NOT_REPO_PATHS.has(span) &&
  (span.includes('/') || /\.(md|json|css|mjs|ts|tsx)$/.test(span));

const paths = [...new Set(spans.filter(isRepoPath))];
const dsCommands = [
  ...new Set(
    spans.flatMap((span) => [...span.matchAll(/(?:^|\s)ds ([a-z][\w-]*)/g)].map((m) => m[1])),
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

  it.each(dsCommands)('ds %s is a command in cli/commands.mjs', (name) => {
    expect(typeof commands[name]).toBe('function');
  });
});
