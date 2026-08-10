import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class RegistryError extends Error {
  constructor(message, hint) {
    super(message);
    this.name = 'RegistryError';
    this.hint = hint;
  }
}

/**
 * npm's stderr is verbose and the useful part is the error code. Translate the
 * codes we can act on into the actual fix.
 */
export function describeNpmFailure(stderr) {
  const text = String(stderr ?? '');

  if (/E401|EAUTHUNKNOWN|Unauthorized/i.test(text)) {
    return 'The registry rejected your credentials. Set a GitHub token with read:packages:\n  pnpm config set "//npm.pkg.github.com/:_authToken" <token>';
  }
  if (/E404/i.test(text)) {
    return 'Package not found on the registry. Check the name, and that your token can see the @elirobinson scope.';
  }
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|ENETUNREACH/i.test(text)) {
    return 'Could not reach the registry — looks like a network problem.';
  }

  return 'npm could not complete the request. Re-run with the npm command shown above to see its full output.';
}

function runNpm(args, cwd) {
  try {
    return execFileSync('npm', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error.stderr ?? error.message;
    throw new RegistryError(`npm ${args.join(' ')} failed`, describeNpmFailure(stderr));
  }
}

export function fetchLatestVersion(name, { cwd = process.cwd() } = {}) {
  const output = runNpm(['view', name, 'version', '--json'], cwd);
  const parsed = JSON.parse(output);
  // `npm view <name> version --json` yields a bare string for a single match.
  return Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
}

/**
 * `npm view … versions --json` yields an array normally, but a bare string when
 * the package has exactly one published version.
 */
export function normalizeVersionsPayload(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string') return [parsed];
  return [];
}

export function fetchAllVersions(name, { cwd = process.cwd() } = {}) {
  return normalizeVersionsPayload(JSON.parse(runNpm(['view', name, 'versions', '--json'], cwd)));
}

/**
 * Downloads the published tarball and reads CHANGELOG.md out of it. Returns
 * null when the tarball predates the packages shipping their changelog — that
 * is expected for older versions, not an error.
 */
export function fetchChangelog(name, version, { cwd = process.cwd() } = {}) {
  const destination = mkdtempSync(join(tmpdir(), 'ds-resync-pack-'));

  try {
    const packed = runNpm(
      ['pack', `${name}@${version}`, '--pack-destination', destination, '--json'],
      cwd,
    );
    const filename = JSON.parse(packed)[0]?.filename;
    if (!filename) return null;

    // npm writes the tarball under its flattened filename, which for a scoped
    // package replaces the slash: @elirobinson/react -> elirobinson-react-1.1.0.tgz
    const tarball = join(destination, filename.replace(/^@/, '').replace('/', '-'));

    try {
      return execFileSync('tar', ['-xzOf', tarball, 'package/CHANGELOG.md'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return null;
    }
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
}
