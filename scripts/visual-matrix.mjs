/* The CI matrix: which sweep jobs exist, and what each one runs.
 *
 * Derived from Playwright's own enumeration, never from a list written down
 * here. That is the whole point, and #105 is what demonstrated it: re-enabling
 * `docs-wide` in playwright.config.ts gave it two sharded jobs of its own with
 * no edit to this file or to visual.yml. A hardcoded matrix would either name a
 * project that does not exist (every job failing with "Project(s) 'docs-wide'
 * not found") or silently omit one that does.
 *
 * Same payload as visual-shots.mjs — `playwright test --list --reporter=json` —
 * read for a different fact. That file maps a test title to its baseline path;
 * this one counts tests per project. Enumerating twice by two different routes
 * is how the two answers drift apart, so both go through Playwright.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';

/* How many machines a project is split across. Absent means one.
 *
 * Only the projects long enough to be the critical path belong here. Measured
 * on run 32287834685: docs-wide was 142 wide captures at 1.37s each (194s),
 * against 107s for the largest storybook project — two shards puts it level
 * with them rather than above them.
 *
 * Still two after #105, which brought the project back clipped to the content
 * region and added the chrome shots: 160 tests now, not 142, so ~219s serial
 * and ~110s a shard. Clipping does not make a shot cheaper — timed on the same
 * 16 docs shots on one host, clipped 24.0s against full-page 23.0s — because
 * the settle loop still captures the whole page, deliberately, and that is the
 * expensive half. A third shard would take a leg to ~73s and the run's wall
 * clock nowhere, since storybook-wide's 107s is then the critical path: it
 * would buy about three seconds for a machine-minute.
 *
 * Sharding is not raising the worker count. Every job still runs
 * `--workers=1`: worker contention is the largest single lever on this suite's
 * flake (18 failures to 1 on the emulated host, see issue #65), so a shard is
 * a separate machine running its own serial browser, never a second browser on
 * the same one. */
export const SHARDS = {
  'docs-wide': 2,
};

/* Projects small enough that a job of their own would be almost entirely
   prologue, run together in one. `smoke` is 9 tests in 2s and `docs-narrow` is
   14 in 11s, against ~80s of container start, install and download before
   either takes a pixel — two jobs here would cost a machine-minute to save
   nine seconds. Grouping them is the only reason this file knows any project
   name at all; everything else it learns from the enumeration. */
export const GROUPS = [['smoke', 'docs-narrow']];

/** Every project Playwright collected, with its test count, sorted by name. */
export function parseProjects(listJson) {
  const counts = new Map();

  for (const spec of collectSpecs(listJson)) {
    for (const test of spec.tests ?? []) {
      counts.set(test.projectName, (counts.get(test.projectName) ?? 0) + 1);
    }
  }

  return [...counts]
    .map(([name, tests]) => ({ name, tests }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectSpecs(node, out = []) {
  for (const spec of node.specs ?? []) {
    out.push(spec);
  }
  for (const suite of node.suites ?? []) {
    collectSpecs(suite, out);
  }
  return out;
}

/**
 * The matrix, one entry per job.
 *
 * Each entry is `{ name, slug, projects, shardIndex, shardTotal }`, where
 * `projects` is a space-separated list rather than an array: GitHub cannot
 * interpolate an array from a matrix context into a `run:` block, and the
 * workflow expands it into repeated `--project=` flags.
 *
 * Throws on an empty enumeration rather than returning `[]`. An empty matrix
 * would skip every sweep job, and a skipped job is not a failed one — the run
 * would go green having compared nothing, which is the exact silent
 * under-selection the release gate in release.yml exists to refuse.
 */
export function planMatrix(projects) {
  if (projects.length === 0) {
    throw new Error(
      'visual-matrix: Playwright collected no projects at all. That is a broken ' +
        'enumeration (an unbuilt Storybook or docs site), not an empty suite — ' +
        'refusing to emit a matrix that would sweep nothing and pass.',
    );
  }

  assertGroupsAreDisjoint();

  const byName = new Map(projects.map((project) => [project.name, project]));
  const entries = [];
  const grouped = new Set();

  for (const group of GROUPS) {
    /* Whichever members are actually present. A group naming a project that is
       currently commented out still emits a job for the rest of it, rather than
       vanishing or failing. */
    const members = group.filter((name) => byName.has(name));
    if (members.length === 0) {
      continue;
    }
    for (const name of members) {
      grouped.add(name);
    }
    entries.push(entry(members, 1, 1));
  }

  for (const project of projects) {
    if (grouped.has(project.name)) {
      continue;
    }
    /* Capped at the test count so a shard can never come out empty. Playwright
       treats an empty selection as a hard "no tests found" failure, and we do
       not pass --pass-with-no-tests: on an unsharded job that error is a real
       signal (the enumeration broke), and blanket-tolerating it here to make
       sharding safe would blind us to it everywhere. */
    const shardTotal = Math.max(1, Math.min(SHARDS[project.name] ?? 1, project.tests));
    for (let shardIndex = 1; shardIndex <= shardTotal; shardIndex += 1) {
      entries.push(entry([project.name], shardIndex, shardTotal));
    }
  }

  return entries;
}

/* The job's display name is what a pull request check reads as, and it is now
   the cheapest failure signal we have — "sweep (storybook-narrow)" says which
   half of the suite broke without opening an artifact. The slug is the same
   fact made safe for an artifact name and a file name. */
function entry(projects, shardIndex, shardTotal) {
  const base = projects.join('+');
  const name = shardTotal > 1 ? `${base} ${shardIndex}/${shardTotal}` : base;
  /* The slug is the same fact spelled for a filesystem: it names an artifact
     and the blob report zip inside it, so it carries neither the `+` of a
     grouped job nor the `/` of a shard. */
  const slugBase = projects.join('-');
  const slug = shardTotal > 1 ? `${slugBase}-${shardIndex}-of-${shardTotal}` : slugBase;

  return {
    name,
    slug,
    projects: projects.join(' '),
    shardIndex,
    shardTotal,
  };
}

/* A project in two groups would be swept twice — two jobs writing the same
   baselines, two verdicts on the same shot, and a merged report holding each
   result twice. Cheap to assert, and impossible to see in a run's output. */
function assertGroupsAreDisjoint() {
  const seen = new Set();
  for (const group of GROUPS) {
    for (const name of group) {
      if (seen.has(name)) {
        throw new Error(
          `visual-matrix: project '${name}' appears in more than one entry of GROUPS. ` +
            'It would be swept twice, by two jobs, against the same baselines.',
        );
      }
      seen.add(name);
    }
  }
}

/**
 * Projects the matrix expected to sweep that the merged report has no trace of.
 *
 * "Every expected job succeeded" is not the same claim as "every expected job
 * ran", and only the second one is safe to publish on. A matrix leg whose blob
 * report failed to upload, or failed to download into the merge, leaves the
 * remaining legs green and the merged report short — a run that looks entirely
 * clean while a whole project was never compared. That is the silent
 * under-selection the release gate exists to refuse, so it is checked against
 * the report rather than inferred from job results.
 *
 * `reported` comes from `parseProjects` over the merged report: a Playwright
 * JSON report nests `suites`/`specs`/`tests` exactly as a `--list` payload
 * does, so the same walk answers both.
 */
export function missingProjects(matrix, reported) {
  const expected = new Set(matrix.flatMap((job) => job.projects.split(' ')));
  const seen = new Set(reported.map((project) => project.name));

  return [...expected].filter((name) => !seen.has(name)).sort();
}

/** Runs Playwright's collection and plans the matrix. Needs both apps built. */
export function listMatrix({ cwd = process.cwd() } = {}) {
  const stdout = execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return planMatrix(parseProjects(JSON.parse(stdout)));
}

/* CLI: two modes.
     node visual-matrix.mjs                              the matrix, as JSON
     node visual-matrix.mjs --verify <matrix> <report>    projects that never reported

   The matrix prints as ONE line of JSON, ready for `fromJSON` in a workflow's
   `strategy.matrix`. One line because it is written to $GITHUB_OUTPUT, where a
   multi-line value needs a heredoc delimiter and a pretty-printed matrix would
   silently truncate to its first line.

   --verify prints nothing and exits 0 when every project the matrix named
   appears in the merged report, so a workflow step can test the exit code
   rather than parse the output.

   realpathSync rather than a bare string compare, for the same reason as
   visual-scope.mjs: process.argv[1] can reach this file through a symlink or a
   relative path and never string-equal import.meta.filename. */
const isEntrypoint = process.argv[1] && realpathSync(process.argv[1]) === import.meta.filename;

if (isEntrypoint) {
  const verify = process.argv.indexOf('--verify');

  if (verify === -1) {
    process.stdout.write(JSON.stringify(listMatrix()));
  } else {
    const [matrixPath, reportPath] = process.argv.slice(verify + 1);
    if (!matrixPath || !reportPath) {
      throw new Error('visual-matrix: --verify needs <matrix.json> <report.json>');
    }

    const missing = missingProjects(
      JSON.parse(readFileSync(matrixPath, 'utf8')),
      parseProjects(JSON.parse(readFileSync(reportPath, 'utf8'))),
    );

    if (missing.length > 0) {
      process.stdout.write(missing.join('\n'));
      process.exitCode = 1;
    }
  }
}
