/* The shots that failed, from Playwright's JSON report.
 *
 * Both recovery paths need this set exactly: `visual-accept` regenerates it on
 * a pull request branch, and the main sweep regenerates it onto a baselines
 * branch. Reading a report rather than parsing logs is what keeps either from
 * regenerating a shot nobody complained about. */

import { readFileSync, realpathSync } from 'node:fs';

import { grepFor } from './visual-missing.mjs';

function collectSpecs(node, out = []) {
  for (const spec of node.specs ?? []) {
    out.push(spec);
  }
  for (const suite of node.suites ?? []) {
    collectSpecs(suite, out);
  }
  return out;
}

/** Titles of every spec that did not pass. De-duplicated across projects. */
export function failedTitles(report) {
  const failed = new Set();

  for (const spec of collectSpecs(report)) {
    if (spec.ok === false) {
      failed.add(spec.title);
    }
  }

  return [...failed];
}

/**
 * Failing titles, one per line, exactly as `failedTitles` returned them —
 * no escaping applied and none to undo, because this never routes through
 * `grepFor`. Null for an empty list, matching `grepFor`'s own convention,
 * so a caller can test for absence instead of printing a blank line.
 */
export function formatPlain(titles) {
  if (titles.length === 0) {
    return null;
  }

  return titles.join('\n');
}

/* CLI: two modes.
     node visual-failures.mjs <report.json>          a --grep pattern
     node visual-failures.mjs --plain <report.json>   plain titles, one per line
   Either prints nothing at all when nothing failed, so a workflow step can
   test the output for emptiness rather than parsing it.

   realpathSync rather than a bare string compare: process.argv[1] can reach
   this file through a symlink (or a relative `./name` / bare-name
   invocation), in which case it never string-equals import.meta.filename
   even though it is the same file on disk. Resolving both to their real path
   first is what makes the comparison correct in all of those cases. */
const isEntrypoint = process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename;

if (isEntrypoint) {
  const args = process.argv.slice(2);
  const plain = args.includes('--plain');
  const path = args.find((arg) => arg !== '--plain');
  if (!path) {
    throw new Error('visual-failures: a path to report.json is required');
  }

  const titles = failedTitles(JSON.parse(readFileSync(path, 'utf8')));

  if (plain) {
    const output = formatPlain(titles);
    if (output) {
      process.stdout.write(`${output}\n`);
    }
  } else {
    const pattern = grepFor(titles.map((title) => ({ title })));
    if (pattern) {
      process.stdout.write(pattern);
    }
  }
}
