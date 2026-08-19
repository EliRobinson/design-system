#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  bumpRange,
  detectPackageManager,
  installCommand,
  writeUpgradeRecord,
  writeVersions,
} from './apply.mjs';
import {
  ARTIFACTS_USAGE,
  MIGRATE_USAGE,
  parseArgs,
  parseArtifactsArgs,
  parseMigrateArgs,
  USAGE,
} from './args.mjs';
import { formatArtifactsReport, runArtifacts } from './artifacts.mjs';
import { isBreaking, sliceChangelog } from './changelog.mjs';
import { detect, findDrift } from './detect.mjs';
import { formatMigrateReport, runMigrate } from './migrate.mjs';
import { collectMigrations, readUpgradeRecord } from './migrations.mjs';
import { promptSelections } from './prompt.mjs';
import { fetchAllVersions, fetchChangelog, RegistryError } from './registry.mjs';
import { compareVersions, jumpClass, parseVersion, selectTarget } from './semver.mjs';
import { resolveTarget } from './targets.mjs';

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

async function migrateCommand(argv) {
  let args;
  try {
    args = parseMigrateArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${MIGRATE_USAGE}`);
    return 1;
  }

  if (args.help) {
    process.stdout.write(MIGRATE_USAGE);
    return 0;
  }

  let result;
  try {
    // detect() rather than survey(): the range comes from the upgrade record
    // and node_modules, so there is nothing here the registry could answer and
    // no reason to make a codemod wait on the network.
    const { packages } = detect(args.cwd);

    const collected = collectMigrations({
      cwd: args.cwd,
      packages,
      record: readUpgradeRecord(args.cwd),
      explicitFrom: args.from,
      explicitTo: args.to,
      only: args.only,
    });

    result = runMigrate({ cwd: args.cwd, packages: collected, write: args.write });
  } catch (error) {
    process.stderr.write(`ds-resync migrate: ${error.message}\n`);
    return 1;
  }

  process.stdout.write(
    args.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatMigrateReport(result)}\n`,
  );

  // Only the reviews trip it. Rewrites under `--write` are done, and rewrites
  // without it are a dry run the caller asked for — neither is a repo left in a
  // state a human still has to visit.
  if (args.failOnPending && result.review.length > 0) return 2;

  return 0;
}

/**
 * The version to measure staleness from, and where it came from.
 *
 * The lockfile first, because that is what CI and a fresh clone install — the
 * state the repo actually ships. `node_modules` is deliberately not consulted:
 * an install that has drifted ahead of the committed manifests would otherwise
 * report the repo as nearly current while the version being built is majors
 * behind. That drift is a finding of its own, reported by `findDrift` below.
 *
 * With no lockfile entry the declared range is all there is. Stripping its
 * operator yields the range's floor, which is not necessarily what the range
 * would resolve to, so the source is carried alongside and the report says
 * plainly that it is comparing against a declared range.
 *
 * Some ranges hold no version at either end — `workspace:*` is the common one,
 * and it locks to `link:…` rather than to a published version. There is nothing
 * to measure those against, so they are marked unresolved and reported as such
 * rather than compared against a version that was never there.
 */
function currentVersionOf(entry) {
  if (entry.lockedVersion)
    return { currentVersion: entry.lockedVersion, currentSource: 'lockfile' };

  const floor = entry.declaredRange.replace(/^[^\d]*/, '');
  if (!parseVersion(floor)) return { currentVersion: null, currentSource: 'unresolved' };

  return { currentVersion: floor, currentSource: 'range' };
}

/**
 * Everything that can be learned before knowing how far the caller wants to
 * jump: which packages are here, what is installed, and what exists upstream.
 * Deliberately does not fetch changelogs — interactive mode runs between this
 * and resolve(), and downloading notes for a package you then decline is waste.
 */
export function survey(cwd, only) {
  const { packageJsonPath, packages, lock } = detect(cwd);

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
    lockfileKind: lock?.kind ?? null,
    entries: selected.map((entry) => ({
      ...entry,
      ...currentVersionOf(entry),
      versions: fetchAllVersions(entry.name, { cwd }),
    })),
  };
}

export function resolve(surveyed, targetSpec, cwd) {
  const packages = surveyed.entries.map((entry) => {
    const from = entry.currentVersion;
    const target = resolveTarget(targetSpec, entry.name);

    // Nothing to compare and nothing to upgrade to. Kept in the report rather
    // than dropped, so a package that silently stops being checked is visible.
    if (from === null) {
      return {
        name: entry.name,
        declaredRange: entry.declaredRange,
        field: entry.field,
        currentVersion: null,
        currentSource: entry.currentSource,
        lockedVersion: entry.lockedVersion,
        installedVersion: entry.installedVersion,
        targetVersion: null,
        latestVersion: null,
        target,
        jump: 'none',
        outdated: false,
        heldBack: false,
        entries: [],
      };
    }

    const targetVersion = selectTarget(from, entry.versions, target) ?? from;
    const latestVersion = selectTarget(from, entry.versions, 'latest') ?? from;

    const outdated = compareVersions(from, targetVersion) < 0;
    const heldBack = compareVersions(targetVersion, latestVersion) < 0;

    let entries = [];
    if (outdated) {
      const changelog = fetchChangelog(entry.name, targetVersion, { cwd });
      if (changelog) entries = sliceChangelog(changelog, from, targetVersion);
    }

    return {
      name: entry.name,
      declaredRange: entry.declaredRange,
      field: entry.field,
      currentVersion: from,
      currentSource: entry.currentSource,
      lockedVersion: entry.lockedVersion,
      installedVersion: entry.installedVersion,
      targetVersion,
      latestVersion,
      target,
      jump: jumpClass(from, targetVersion),
      outdated,
      heldBack,
      entries,
    };
  });

  const { command, args } = installCommand(detectPackageManager(cwd));

  return {
    packageJsonPath: surveyed.packageJsonPath,
    lockfileKind: surveyed.lockfileKind,
    packages,
    drift: findDrift(surveyed.entries),
    installHint: `${command} ${args.join(' ')}`,
    wrote: false,
  };
}

/**
 * The loud half of the report. `node_modules` disagreeing with the lockfile is
 * a different condition from being behind — a different cause and a different
 * fix — so it is named separately, and first: while it holds, every tool that
 * introspects installed code is answering for a version this repo does not
 * build. The `!!` gutter matches the stale-snapshot warning in `artifacts`.
 */
export function formatInstallDrift(drift, installHint = 'pnpm install') {
  return [
    '!!  NODE_MODULES OUT OF SYNC',
    '!!  The versions installed in node_modules do not match the lockfile:',
    ...drift.map(
      (entry) => `!!    ${entry.name}  lockfile ${entry.locked}, node_modules ${entry.installed}`,
    ),
    '!!',
    '!!  The lockfile is what CI and a fresh clone install, so everything below is',
    '!!  measured against it. Tools that read installed code — `elirobinson-ds` and',
    '!!  any agent following it — are describing versions this repo does not build.',
    '!!',
    `!!  Fix it with \`${installHint}\`. This is an install, not an upgrade.`,
  ].join('\n');
}

export function formatReport(result) {
  const lines = [];

  if (result.packages.length === 0) {
    return 'No @elirobinson/* dependencies found in this package.json.';
  }

  const outdated = result.packages.filter((entry) => entry.outdated);

  for (const entry of result.packages) {
    if (entry.currentSource === 'unresolved') {
      lines.push(
        `  ${entry.name}  not compared — "${entry.declaredRange}" names no published version`,
      );
      continue;
    }

    const heldBackNote = entry.heldBack
      ? `    ${entry.latestVersion} is available, held back by --target ${entry.target}`
      : null;

    // A package missing from an otherwise present lockfile is worth calling out
    // per package, since the whole-report note above does not cover it.
    const baselineNote =
      result.lockfileKind && entry.currentSource === 'range'
        ? `    not in the lockfile — compared against the range "${entry.declaredRange}"`
        : null;

    if (!entry.outdated) {
      lines.push(`  ${entry.name}  ${entry.currentVersion}  (up to date)`);
      if (baselineNote) lines.push(baselineNote);
      if (heldBackNote) lines.push(heldBackNote);
      continue;
    }

    const breaking = entry.jump === 'major' || entry.entries.some(isBreaking);
    const label = breaking ? '  [breaking]' : '';
    lines.push(
      `  ${entry.name}  ${entry.currentVersion} → ${entry.targetVersion}  (${entry.jump})${label}`,
    );

    if (baselineNote) lines.push(baselineNote);
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

  // Both preambles sit above the count so the loudest fact is the first one
  // read, and so the reader knows which baseline the numbers below are against.
  const preamble = [];

  if (result.drift?.length) {
    preamble.push(formatInstallDrift(result.drift, result.installHint), '');
  }

  if (result.lockfileKind === null) {
    preamble.push(
      'No lockfile here, so these are compared against the ranges declared in package.json,',
      'not against resolved versions.',
      '',
    );
  }

  if (outdated.length === 0) {
    lines.unshift(...preamble, 'Everything is up to date.', '');
    return lines.join('\n');
  }

  lines.unshift(
    ...preamble,
    `${outdated.length} package${outdated.length === 1 ? '' : 's'} behind:`,
    '',
  );

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
  const crossed = [];

  for (const entry of result.packages) {
    if (!entry.outdated) continue;

    const newRange = bumpRange(entry.declaredRange, entry.targetVersion);
    if (newRange === null) {
      entry.skipped = true;
      continue;
    }

    updates.push({ name: entry.name, field: entry.field, newRange });
    crossed.push({ name: entry.name, from: entry.currentVersion, to: entry.targetVersion });
  }

  if (updates.length === 0) return;

  writeVersions(result.packageJsonPath, updates);
  // Before the install, not after: the record is what `ds-resync migrate` reads
  // to know where this upgrade started, and after the install that fact exists
  // nowhere else on disk.
  writeUpgradeRecord(cwd, crossed);

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
  if (argv[0] === 'migrate') return migrateCommand(argv.slice(1));

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

  // Two findings, two flags. Being behind and having an out-of-sync install
  // have different causes and different fixes, so a pipeline that cares about
  // one should not be failed by the other; a run that writes has already dealt
  // with both. They share exit code 2 — the report says which one tripped.
  const anyOutdated = result.packages.some((entry) => entry.outdated);
  if (args.failOnOutdated && anyOutdated && !result.wrote) return 2;
  if (args.failOnOutOfSync && result.drift.length > 0 && !result.wrote) return 2;

  return 0;
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
