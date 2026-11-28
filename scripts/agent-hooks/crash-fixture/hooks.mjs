// @ts-check
// Module resolve hook for register.mjs. When a hook entry
// (review-gate.mjs, guard-main-checkout.mjs) imports a module that parses
// shell, this hands it the stub of the same name in this folder instead.
// Each stub re-exports the real module and swaps in a parse function that
// throws. A stub's own import of the real module is left alone.

const ENTRIES = ['/agent-hooks/review-gate.mjs', '/agent-hooks/guard-main-checkout.mjs'];
const STUBBED = new Set([
  './review-gate-bypass.mjs',
  './review-gate-policy.mjs',
  './guard-main-checkout-policy.mjs',
]);

/**
 * @param {string} specifier
 * @param {{ parentURL?: string }} context
 * @param {(specifier: string, context: object) => unknown} nextResolve
 */
export function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL ?? '';
  if (STUBBED.has(specifier) && ENTRIES.some((entry) => parent.endsWith(entry))) {
    return { url: new URL(specifier, import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
