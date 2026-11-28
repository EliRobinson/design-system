// @ts-check
// Stub: see hooks.mjs. Throws while it loads, so the guard's import() of the
// policy rejects. guardDecision is here only to match the real module's
// exports; the guard never gets to call it.
export function guardDecision() {}

throw new Error('injected load failure in guard-main-checkout-policy.mjs');
