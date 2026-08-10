import { SCOPE } from './detect.mjs';

export const TARGETS = ['latest', 'minor', 'patch'];

export const DEFAULT_TARGET_SPEC = { fallback: 'latest', byName: {} };

export function normalizePackageName(name) {
  const trimmed = String(name).trim();
  return trimmed.startsWith(SCOPE) ? trimmed : `${SCOPE}${trimmed}`;
}

function assertTarget(value) {
  if (!TARGETS.includes(value)) {
    throw new Error(`Unknown target: ${value}. Valid targets are ${TARGETS.join(', ')}.`);
  }
  return value;
}

export function parseOnly(value) {
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizePackageName);
}

/**
 * Accepts a bare target ("minor"), per-package assignments
 * ("react=minor,tokens=patch"), or both ("minor,react=latest") — the bare one
 * becomes the fallback for packages with no assignment of their own.
 */
export function parseTargetSpec(value) {
  const spec = { fallback: 'latest', byName: {} };

  for (const part of String(value).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      spec.fallback = assertTarget(trimmed);
      continue;
    }

    const name = normalizePackageName(trimmed.slice(0, separator));
    spec.byName[name] = assertTarget(trimmed.slice(separator + 1).trim());
  }

  return spec;
}

export function resolveTarget(spec, name) {
  return spec.byName[name] ?? spec.fallback;
}
