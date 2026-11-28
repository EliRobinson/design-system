// @ts-check
// Stub: see hooks.mjs. A local export wins over the `export *` of the same name.
export * from '../review-gate-bypass.mjs';

export function findBypass() {
  throw new Error('injected parser failure in findBypass');
}
