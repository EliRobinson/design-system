#!/usr/bin/env node

// `elirobinson-ds` — ask the installed design system what exists, instead of
// trusting a doc that went stale on the last release.
//
// Wire it up as a script so agents and humans reach for the same command:
//   "scripts": { "ds": "elirobinson-ds" }

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run } from './run.mjs';

const selfDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { text, exitCode, warning } = run(process.argv.slice(2), { selfDir });

// stderr, and never folded into `text`: this output gets piped and parsed, and
// a caveat that corrupts the answer it is warning about helps nobody. The
// warning does not change the exit code either — the command still succeeded.
if (warning) process.stderr.write(`${warning}\n`);

(exitCode === 0 ? process.stdout : process.stderr).write(`${text}\n`);
process.exitCode = exitCode;
