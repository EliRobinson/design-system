#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';
import { bumpRange, detectPackageManager, installCommand, writeVersions } from './apply.mjs';
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
`;

export function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    cwd: process.cwd(),
    failOnOutdated: false,
    help: false,
    only: null,
    targetSpec: DEFAULT_TARGET_SPEC,
    interactive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--write') args.write = true;
    else if (argument === '--json') args.json = true;
    else if (argument === '--fail-on-outdated') args.failOnOutdated = true;
    else if (argument === '--help' || argument === '-h') args.help = true;
    else if (argument === '--interactive' || argument === '-i') args.interactive = true;
    else if (argument === '--cwd') {
      index += 1;
      args.cwd = resolvePath(argv[index] ?? '.');
    } else if (argument.startsWith('--cwd=')) {
      args.cwd = resolvePath(argument.slice('--cwd='.length));
    } else if (argument === '--only') {
      index += 1;
      args.only = parseOnly(argv[index] ?? '');
    } else if (argument.startsWith('--only=')) {
      args.only = parseOnly(argument.slice('--only='.length));
    } else if (argument === '--target') {
      index += 1;
      args.targetSpec = parseTargetSpec(argv[index] ?? '');
    } else if (argument.startsWith('--target=')) {
      args.targetSpec = parseTargetSpec(argument.slice('--target='.length));
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  // Asking which packages to update and then not updating them is not a
  // meaningful mode, so the interactive flag carries the write intent.
  if (args.interactive) args.write = true;

  return args;
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

// Only run when invoked as a binary, so the module stays importable by tests.
if (process.argv[1] && process.argv[1].endsWith('cli.mjs')) {
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
