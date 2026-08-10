const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+[0-9A-Za-z-.]+)?$/;

/**
 * Parses a semver string. Build metadata is accepted and discarded — it is not
 * part of precedence.
 */
export function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const match = VERSION_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, major, minor, patch, prerelease] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease
      ? prerelease.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : [],
  };
}

function comparePrerelease(a, b) {
  // A version with no prerelease outranks one that has any.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === right) continue;

    const leftIsNumber = typeof left === 'number';
    const rightIsNumber = typeof right === 'number';
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (leftIsNumber !== rightIsNumber) return leftIsNumber ? -1 : 1;
    return left < right ? -1 : 1;
  }

  // Identical through the shorter one: more identifiers wins.
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

export function compareVersions(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left) throw new TypeError(`Unparseable version: ${a}`);
  if (!right) throw new TypeError(`Unparseable version: ${b}`);

  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }

  return comparePrerelease(left.prerelease, right.prerelease);
}

/**
 * Classifies the size of an upgrade. Below 1.0.0 a minor bump is treated as
 * major, matching the semver convention that 0.x makes no stability promise —
 * tokens and ai-patterns are both still pre-1.0.
 */
export function jumpClass(from, to) {
  const left = parseVersion(from);
  const right = parseVersion(to);
  if (!left) throw new TypeError(`Unparseable version: ${from}`);
  if (!right) throw new TypeError(`Unparseable version: ${to}`);

  if (left.major !== right.major) return 'major';

  const preOneZero = left.major === 0 && right.major === 0;
  if (left.minor !== right.minor) return preOneZero ? 'major' : 'minor';
  if (left.patch !== right.patch) return 'patch';
  if (comparePrerelease(left.prerelease, right.prerelease) !== 0) return 'prerelease';

  return 'none';
}

const TARGET_CONSTRAINTS = {
  latest: () => true,
  minor: (current, candidate) => candidate.major === current.major,
  patch: (current, candidate) =>
    candidate.major === current.major && candidate.minor === current.minor,
};

/**
 * The furthest version worth moving to, given how far the caller is willing to
 * jump. Prereleases are excluded from the candidate set — opting into one is a
 * deliberate act, not something an upgrade command should do on your behalf —
 * but a prerelease is still valid as the version you are on.
 */
export function selectTarget(current, versions, target) {
  const constraint = TARGET_CONSTRAINTS[target];
  if (!constraint) throw new TypeError(`Unknown target: ${target}`);

  const from = parseVersion(current);
  if (!from) throw new TypeError(`Unparseable version: ${current}`);

  let best = null;

  for (const value of versions) {
    const candidate = parseVersion(value);
    if (!candidate) continue;
    if (candidate.prerelease.length > 0) continue;
    if (!constraint(from, candidate)) continue;
    if (compareVersions(value, current) < 0) continue;
    if (best === null || compareVersions(value, best) > 0) best = value;
  }

  return best;
}
