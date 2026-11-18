/* Shared by the tests that read the agent-facing docs this repo ships
 * (style-guard, stylesheet-rule). Not collected as a test, not published. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { repoRoot } from '../artifacts/published-files.test-helper.mjs';

/** Read a file by its repo-relative path. */
export const read = (path) => readFileSync(join(repoRoot, path), 'utf8');

/** Prose wraps, so compare on collapsed whitespace. */
export const flat = (text) => text.replace(/\s+/g, ' ');

/** Repo-relative path of a template `init --agents` writes. */
export const templatePath = (name) => `packages/ai-patterns/src/agents/${name}`;

/** The default app's AGENTS.md: not written by init, but read by the same agents. */
export const DEFAULT_APP_AGENTS = 'templates/default-app/AGENTS.md';
