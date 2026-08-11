#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bumpRange, detectPackageManager, installCommand, writeVersions } from './apply.mjs';
import { formatArtifactsReport, runArtifacts } from './artifacts.mjs';
import { isBreaking, sliceChangelog } from './changelog.mjs';
import { detect } from './detect.mjs';
import { promptSelections } from './prompt.mjs';
import { fetchAllVersions, fetchChangelog, RegistryError } from './registry.mjs';
import { compareVersions, jumpClass, selectTarget } from './semver.mjs';
import {
  DEFAULT_TARGET_SPEC,
  parseOnly,
  parseTargetSpec,
  resolveTarget,
  TARGETS,
} from './targets.mjs';

const USAGE = `ds-resync — bring this repo's @elirobinson packages up to date

Usage: ds-resync [options]
       ds-resync artifacts [options]

Commands:
  (default)             Report and optionally apply dependency upgrades
  artifacts             Sync the design system's agent skills into this repo

Options:
  --write               Apply the upgrades and install (default is read-only)
  --only <names>        Restrict to these packages (comma-separated, scope optional)
  --target <spec>       How far to jump: ${TARGETS.join(' | ')}
                        Global ("minor") or per-package ("react=minor,tokens=latest")
  --interactive, -i     Choose per package, then apply (implies --write)
  --json                Emit the report as JSON
  --cwd <dir>           Target a directory other than the current one
  --fail-on-outdated    Exit 2 when anything is behind (for CI)
  -h, --help            Show this message

Run \`ds-resync artifacts --help\` for that command's options.
`;

const ARTIFACTS_USAGE = `ds-resync artifacts — sync the design system's agent skills into this repo

Writes the brand skill, a version-stamped component reference (llms.txt /
llms-full.txt), and the re-sync instructions into .claude/skills/. Files you have
edited since they were written are left alone and listed in the report.

Usage: ds-resync artifacts [options]

Options:
  --write               Apply the changes (default is read-only)
  --force               Overwrite files you have edited locally
  --json                Emit the plan as JSON
  --cwd <dir>           Target a directory other than the current one
  --fail-on-drift       Exit 2 when the snapshot and the installed
                        @elirobinson/react disagree (for CI)
  -h, --help            Show this message
`;

/**
 * Every flag either command understands, declared once. A `boolean` flag sets
 * its key to true; a `value` flag takes the next argv item — or the text after
 * `=`, both spellings come free — and runs it through `parse`, substituting
 * `whenValueAbsent` if the flag ends argv with nothing after it.
 *
 * `whenOmitted` supplies the key's value when the flag is not passed at all. It
 * is a function rather than a value because `--cwd` has to read `process.cwd()`
 * at parse time, not at module load; the other two follow the same shape so the
 * field has one type rather than two.
 *
 * The point of the table is that a flag's parsing lives in exactly one place:
 * teaching both commands a new flag is a line here and a line in each command's
 * list below, with no second else-if chain to forget. The usage text above is
 * still written by hand, so that much remains a separate edit.
 */
const FLAGS = {
  write: { flag: '--write', key: 'write', type: 'boolean' },
  force: { flag: '--force', key: 'force', type: 'boolean' },
  json: { flag: '--json', key: 'json', type: 'boolean' },
  failOnDrift: { flag: '--fail-on-drift', key: 'failOnDrift', type: 'boolean' },
  failOnOutdated: { flag: '--fail-on-outdated', key: 'failOnOutdated', type: 'boolean' },
  interactive: { flag: '--interactive', alias: '-i', key: 'interactive', type: 'boolean' },
  help: { flag: '--help', alias: '-h', key: 'help', type: 'boolean' },
  cwd: {
    flag: '--cwd',
    key: 'cwd',
    type: 'value',
    parse: (value) => resolvePath(value),
    whenValueAbsent: '.',
    whenOmitted: () => process.cwd(),
  },
  only: {
    flag: '--only',
    key: 'only',
    type: 'value',
    parse: parseOnly,
    whenValueAbsent: '',
    whenOmitted: () => null,
  },
  target: {
    flag: '--target',
    key: 'targetSpec',
    type: 'value',
    parse: parseTargetSpec,
    whenValueAbsent: '',
    whenOmitted: () => DEFAULT_TARGET_SPEC,
  },
};

// The two lists are deliberately not the same set. A flag absent from a
// command's list is an unknown option there, which is the behaviour worth
// keeping: `--force` has nothing to overwrite during a version sync, and
// `--target` has no version to aim at during an artifact copy.
const ARTIFACTS_FLAGS = [
  FLAGS.write,
  FLAGS.force,
  FLAGS.json,
  FLAGS.failOnDrift,
  FLAGS.cwd,
  FLAGS.help,
];

const RESYNC_FLAGS = [
  FLAGS.write,
  FLAGS.json,
  FLAGS.failOnOutdated,
  FLAGS.interactive,
  FLAGS.only,
  FLAGS.target,
  FLAGS.cwd,
  FLAGS.help,
];

function parseFlags(argv, specs) {
  const args = {};
  const byName = new Map();

  for (const spec of specs) {
    args[spec.key] = spec.type === 'boolean' ? false : spec.whenOmitted();
    byName.set(spec.flag, spec);
    if (spec.alias) byName.set(spec.alias, spec);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equalsIndex = argument.indexOf('=');
    const spec = byName.get(equalsIndex === -1 ? argument : argument.slice(0, equalsIndex));

    // An `=` only means something to a flag that takes a value, so `--write=1`
    // stays an unknown option rather than quietly reading as true.
    if (!spec || (spec.type === 'boolean' && equalsIndex !== -1)) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (spec.type === 'boolean') {
      args[spec.key] = true;
      continue;
    }

    let value;
    if (equalsIndex === -1) {
      index += 1;
      value = argv[index];
    } else {
      value = argument.slice(equalsIndex + 1);
    }

    args[spec.key] = spec.parse(value ?? spec.whenValueAbsent);
  }

  return args;
}

export function parseArtifactsArgs(argv) {
  return parseFlags(argv, ARTIFACTS_FLAGS);
}

export function parseArgs(argv) {
  const args = parseFlags(argv, RESYNC_FLAGS);

  // Asking which packages to update and then not updating them is not a
  // meaningful mode, so the interactive flag carries the write intent.
  if (args.interactive) args.write = true;

  return args;
}

async function artifactsCommand(argv) {
  let args;
  try {
    args = parseArtifactsArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${ARTIFACTS_USAGE}`);
    return 1;
  }

  if (args.help) {
    process.stdout.write(ARTIFACTS_USAGE);
    return 0;
  }

  let result;
  try {
    result = runArtifacts({ cwd: args.cwd, write: args.write, force: args.force });
  } catch (error) {
    process.stderr.write(`ds-resync artifacts: ${error.message}\n`);
    return 1;
  }

  process.stdout.write(
    args.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatArtifactsReport(result)}\n`,
  );

  return args.failOnDrift && result.drift ? 2 : 0;
}

/**
 * Everything that can be learned before knowing how far the caller wants to
 * jump: which packages are here, what is installed, and what exists upstream.
 * Deliberately does not fetch changelogs — interactive mode runs between this
 * and resolve(), and downloading notes for a package you then decline is waste.
 */
export function survey(cwd, only) {
  const { packageJsonPath, packages } = detect(cwd);

  if (only) {
    const known = new Set(packages.map((item) => item.name));
    for (const name of only) {
      if (!known.has(name)) {
        const found = [...known].join(', ') || 'none';
        throw new Error(`--only names ${name}, which is not a dependency here. Found: ${found}`);
      }
    }
  }

  const selected = only ? packages.filter((item) => only.includes(item.name)) : packages;

  return {
    packageJsonPath,
    entries: selected.map((entry) => ({
      ...entry,
      // Without an install, the declared range is the only reference point we
      // have; strip its operator so it can be compared.
      reference: entry.installedVersion ?? entry.declaredRange.replace(/^[^\d]*/, ''),
      versions: fetchAllVersions(entry.name, { cwd }),
    })),
  };
}

export function resolve(surveyed, targetSpec, cwd) {
  const packages = surveyed.entries.map((entry) => {
    const target = resolveTarget(targetSpec, entry.name);
    const targetVersion = selectTarget(entry.reference, entry.versions, target) ?? entry.reference;
    const latestVersion =
      selectTarget(entry.reference, entry.versions, 'latest') ?? entry.reference;

    const outdated = compareVersions(entry.reference, targetVersion) < 0;
    const heldBack = compareVersions(targetVersion, latestVersion) < 0;

    let entries = [];
    if (outdated) {
      const changelog = fetchChangelog(entry.name, targetVersion, { cwd });
      if (changelog) entries = sliceChangelog(changelog, entry.reference, targetVersion);
    }

    return {
      name: entry.name,
      declaredRange: entry.declaredRange,
      field: entry.field,
      installedVersion: entry.reference,
      targetVersion,
      latestVersion,
      target,
      jump: jumpClass(entry.reference, targetVersion),
      outdated,
      heldBack,
      entries,
    };
  });

  return { packageJsonPath: surveyed.packageJsonPath, packages, wrote: false };
}

export function formatReport(result) {
  const lines = [];

  if (result.packages.length === 0) {
    return 'No @elirobinson/* dependencies found in this package.json.';
  }

  const outdated = result.packages.filter((entry) => entry.outdated);

  for (const entry of result.packages) {
    const heldBackNote = entry.heldBack
      ? `    ${entry.latestVersion} is available, held back by --target ${entry.target}`
      : null;

    if (!entry.outdated) {
      lines.push(`  ${entry.name}  ${entry.installedVersion}  (up to date)`);
      if (heldBackNote) lines.push(heldBackNote);
      continue;
    }

    const breaking = entry.jump === 'major' || entry.entries.some(isBreaking);
    const label = breaking ? '  [breaking]' : '';
    lines.push(
      `  ${entry.name}  ${entry.installedVersion} → ${entry.targetVersion}  (${entry.jump})${label}`,
    );

    if (heldBackNote) lines.push(heldBackNote);

    if (entry.skipped) {
      lines.push(
        `    range "${entry.declaredRange}" is not a simple range — left unchanged, update it by hand`,
      );
    }

    for (const changelogEntry of entry.entries) {
      lines.push('', `    ── ${changelogEntry.version} ──`);
      for (const line of changelogEntry.body.split('\n')) lines.push(`    ${line}`);
    }

    if (entry.entries.length === 0) {
      lines.push('    (no changelog shipped in this version — see the repo for notes)');
    }

    lines.push('');
  }

  if (outdated.length === 0) {
    lines.unshift('Everything is up to date.', '');
    return lines.join('\n');
  }

  lines.unshift(`${outdated.length} package${outdated.length === 1 ? '' : 's'} behind:`, '');

  if (!result.wrote) {
    lines.push('Run `ds-resync --write` to apply these upgrades.');
  }

  if (result.installError) {
    lines.push(
      '',
      `package.json was updated, but ${result.installError}.`,
      'Check the install output above, then re-run your package manager by hand.',
    );
  }

  return lines.join('\n');
}

function applyUpgrades(result, cwd) {
  const updates = [];

  for (const entry of result.packages) {
    if (!entry.outdated) continue;

    const newRange = bumpRange(entry.declaredRange, entry.targetVersion);
    if (newRange === null) {
      entry.skipped = true;
      continue;
    }

    updates.push({ name: entry.name, field: entry.field, newRange });
  }

  if (updates.length === 0) return;

  writeVersions(result.packageJsonPath, updates);

  const { command, args } = installCommand(detectPackageManager(cwd));

  try {
    execFileSync(command, args, { cwd, stdio: 'inherit' });
  } catch (error) {
    // package.json is already rewritten by this point, so swallowing the throw
    // and recording it is what lets the caller still print the report — the
    // user needs to see which ranges moved in order to recover by hand.
    //
    // A non-zero exit here does not always mean the install failed: pnpm exits
    // 1 on ERR_PNPM_IGNORED_BUILDS, which is a warning about postinstall
    // scripts, not a broken install. Report it and let the user judge.
    result.installError = `\`${command} ${args.join(' ')}\` exited ${error.status ?? 'non-zero'}`;
  }
}

export async function main(argv) {
  // A subcommand, not a flag on the default run: the version sync and the
  // artifact sync share nothing but a package name, and folding them together
  // would make every flag ambiguous about which half it applies to.
  if (argv[0] === 'artifacts') return artifactsCommand(argv.slice(1));

  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    return 1;
  }

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  let result;
  try {
    const surveyed = survey(args.cwd, args.only);

    let targetSpec = args.targetSpec;
    if (args.interactive) {
      if (!process.stdin.isTTY) {
        process.stderr.write(
          'ds-resync: --interactive needs a terminal. Use --only and --target instead.\n',
        );
        return 1;
      }

      const selection = await promptSelections(surveyed.entries, {
        input: process.stdin,
        output: process.stdout,
      });

      surveyed.entries = surveyed.entries.filter((entry) => selection.only.includes(entry.name));
      targetSpec = selection.targetSpec;
    }

    result = resolve(surveyed, targetSpec, args.cwd);
    if (args.write) {
      applyUpgrades(result, args.cwd);
      result.wrote = true;
    }
  } catch (error) {
    process.stderr.write(`ds-resync: ${error.message}\n`);
    if (error instanceof RegistryError) process.stderr.write(`${error.hint}\n`);
    return 1;
  }

  process.stdout.write(
    args.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatReport(result)}\n`,
  );

  if (result.installError) return 1;

  const anyOutdated = result.packages.some((entry) => entry.outdated);
  return args.failOnOutdated && anyOutdated && !result.wrote ? 2 : 0;
}

/**
 * True when this file is the process entry point, and not an import from a
 * test. Matching on the argv[1] filename is not enough: npm installs a bin as a
 * symlink, and Node reports the symlink path in argv[1] — `.bin/ds-resync`,
 * which ends in neither `.mjs` nor `cli`. Under such an install the whole CLI
 * silently did nothing. Resolving the link and comparing URLs handles the
 * symlink, the pnpm shim, and a direct `node src/resync/cli.mjs` alike.
 */
function invokedAsBinary() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (invokedAsBinary()) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
