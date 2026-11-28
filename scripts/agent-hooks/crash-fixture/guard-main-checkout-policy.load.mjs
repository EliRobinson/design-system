// @ts-check
// Stub: see hooks.mjs. Throws while it loads. It exports what its importer
// asks for, so the throw comes from running the module, not from linking it.
export function guardDecision() {}

throw new Error('injected load failure in guard-main-checkout-policy.mjs');
