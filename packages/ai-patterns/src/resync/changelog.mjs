import { compareVersions, parseVersion } from './semver.mjs';

const VERSION_HEADING = /^##\s+(.+?)\s*$/;

/**
 * Splits a changesets-generated CHANGELOG.md into per-version entries.
 * Headings that are not versions ("## Unreleased") are dropped, along with
 * any text before the first version heading.
 */
export function parseChangelog(markdown) {
  if (typeof markdown !== 'string' || markdown.length === 0) return [];

  const entries = [];
  let current = null;

  for (const line of markdown.split('\n')) {
    const match = VERSION_HEADING.exec(line);

    if (match) {
      if (current) entries.push(current);
      current = parseVersion(match[1]) ? { version: match[1], body: [] } : null;
      continue;
    }

    if (current) current.body.push(line);
  }

  if (current) entries.push(current);

  return entries.map((entry) => ({ version: entry.version, body: entry.body.join('\n').trim() }));
}

/**
 * The entries a consumer missed: everything published after the version they
 * are on, up to and including the one they are moving to.
 */
export function sliceChangelog(markdown, fromVersion, toVersion) {
  return parseChangelog(markdown).filter(
    (entry) =>
      compareVersions(entry.version, fromVersion) > 0 &&
      compareVersions(entry.version, toVersion) <= 0,
  );
}

export function isBreaking(entry) {
  return /^###\s+Major Changes\s*$/m.test(entry.body);
}
