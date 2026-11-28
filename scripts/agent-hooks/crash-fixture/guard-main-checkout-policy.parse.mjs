// @ts-check
// Stub: see hooks.mjs. A local export wins over the `export *` of the same name.
export * from '../guard-main-checkout-policy.mjs';

export function guardDecision() {
  throw new Error('injected parser failure in guardDecision');
}
