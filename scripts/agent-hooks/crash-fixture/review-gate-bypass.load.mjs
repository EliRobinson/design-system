// @ts-check
// Stub: see hooks.mjs. Throws while it loads. It exports what its importer
// asks for, so the throw comes from running the module, not from linking it.
export function findBypass() {}

throw new Error('injected load failure in review-gate-bypass.mjs');
