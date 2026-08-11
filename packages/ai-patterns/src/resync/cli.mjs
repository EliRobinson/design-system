#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { bumpRange, detectPackageManager, installCommand, writeVersions } from './apply.mjs';
import { isBreaking, sliceChangelog } from './changelog.mjs';
import { detect } from './detect.mjs';
import { fetchChangelog, fetchLatestVersion, RegistryError } from './registry.mjs';
import { compareVersions, jumpClass } from './semver.mjs';

const USAGE = `ds-resync — bring this repo's @elirobinson packages up to date

Usage: ds-resync [options]

Options:
  --write               Apply the upgrades and install (default is read-only)
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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--write') args.write = true;
    else if (argument === '--json') args.json = true;
    else if (argument === '--fail-on-outdated') args.failOnOutdated = true;
    else if (argument === '--help' || argument === '-h') args.help = true;
    else if (argument === '--cwd') {
      index += 1;
      args.cwd = resolve(argv[index] ?? '.');
    } else if (argument.startsWith('--cwd=')) {
      args.cwd = resolve(argument.slice('--cwd='.length));
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return args;
}

function inspect(cwd) {
  const { packageJsonPath, packages } = detect(cwd);

  const inspected = packages.map((entry) => {
    const latestVersion = fetchLatestVersion(entry.name, { cwd });
    // Without an install, the declared range is the only reference point we
    // have; strip its operator so it can be compared.
    const reference = entry.installedVersion ?? entry.declaredRange.replace(/^[^\d]*/, '');
    const outdated = compareVersions(reference, latestVersion) < 0;

    let entries = [];
    if (outdated) {
      const changelog = fetchChangelog(entry.name, latestVersion, { cwd });
      if (changelog) entries = sliceChangelog(changelog, reference, latestVersion);
    }

    return {
      ...entry,
      installedVersion: reference,
      latestVersion,
      jump: jumpClass(reference, latestVersion),
      outdated,
      entries,
    };
  });

  return { packageJsonPath, packages: inspected, wrote: false };
}

export function formatReport(result) {
  const lines = [];

  if (result.packages.length === 0) {
    return 'No @elirobinson/* dependencies found in this package.json.';
  }

  const outdated = result.packages.filter((entry) => entry.outdated);

  for (const entry of result.packages) {
    if (!entry.outdated) {
      lines.push(`  ${entry.name}  ${entry.installedVersion}  (up to date)`);
      continue;
    }

    const breaking = entry.jump === 'major' || entry.entries.some(isBreaking);
    const label = breaking ? '  [breaking]' : '';
    lines.push(
      `  ${entry.name}  ${entry.installedVersion} → ${entry.latestVersion}  (${entry.jump})${label}`,
    );

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

    const newRange = bumpRange(entry.declaredRange, entry.latestVersion);
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

export function main(argv) {
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
    result = inspect(args.cwd);
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
  process.exitCode = main(process.argv.slice(2));
}
