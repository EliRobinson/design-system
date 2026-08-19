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

/* CLI: prints the pattern, or nothing at all when nothing failed, so a
   workflow step can test the output for emptiness.

   realpathSync rather than a bare string compare: process.argv[1] can reach
   this file through a symlink (or a relative `./name` / bare-name
   invocation), in which case it never string-equals import.meta.filename
   even though it is the same file on disk. Resolving both to their real path
   first is what makes the comparison correct in all of those cases. */
const isEntrypoint = process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename;

if (isEntrypoint) {
  const path = process.argv[2];
  if (!path) {
    throw new Error('visual-failures: a path to report.json is required');
  }

  const titles = failedTitles(JSON.parse(readFileSync(path, 'utf8')));
  const pattern = grepFor(titles.map((title) => ({ title })));
  if (pattern) {
    process.stdout.write(pattern);
  }
}
