// @ts-check
// Module resolve hook for throw-on-parse.mjs and throw-on-load.mjs. When a
// module that loads the hook rules imports one of STUBBED, this hands it the
// stub `<name>.<mode>.mjs` in this folder instead, if there is one:
// - `parse` stubs re-export the real module and swap in a parse function
//   that throws when it is called.
// - `load` stubs throw while they load.
// A stub's own import of the real module is left alone, since its parent is
// not one of IMPORTERS.

// The modules that import the hook rules. Keep in step with the hook files.
const IMPORTERS = ['/agent-hooks/review-gate-run.mjs', '/agent-hooks/guard-main-checkout.mjs'];

// Keyed by the exact specifier strings IMPORTERS use in their import
// statements and import() calls: `./review-gate-bypass.mjs`, not a path. A
// specifier spelled another way there is not stubbed. Values are the modes
// that have a stub.
/** @type {Record<string, string[]>} */
const STUBBED = {
  './review-gate-bypass.mjs': ['parse', 'load'],
  './review-gate-policy.mjs': ['parse'],
  './guard-main-checkout-policy.mjs': ['parse', 'load'],
};

let mode = '';

/** @param {{ mode: string }} data */
export function initialize(data) {
  mode = data.mode;
}

/**
 * @param {string} specifier
 * @param {{ parentURL?: string }} context
 * @param {(specifier: string, context: object) => unknown} nextResolve
 */
export function resolve(specifier, context, nextResolve) {
  const parent = context.parentURL ?? '';
  const modes = Object.hasOwn(STUBBED, specifier) ? STUBBED[specifier] : [];
  if (modes.includes(mode) && IMPORTERS.some((importer) => parent.endsWith(importer))) {
    const stub = specifier.replace(/\.mjs$/, `.${mode}.mjs`);
    return { url: new URL(stub, import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
