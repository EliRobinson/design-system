import { REVIEWERS } from './review-gate-policy.mjs';

// Built at run time so no test file contains a literal PR command. An agent
// that writes these files through a shell would otherwise trip the hook.
export const GH = ['g', 'h'].join('');
export const CREATE = `${GH} pr create`;

/** A PR body whose Review section has a filled line for each reviewer. */
export function filledReview(value = 'no findings') {
  return ['## Review', '', ...REVIEWERS.map(({ label }) => `- **${label}:** ${value}`)].join('\n');
}
