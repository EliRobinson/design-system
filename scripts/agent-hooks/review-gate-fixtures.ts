import { REVIEWERS } from './review-gate-policy.mjs';

// Built at run time so no test file contains a literal PR command. An agent
// that writes these files through a shell would otherwise trip the hook.
export const GH = ['g', 'h'].join('');
export const CREATE = `${GH} pr create`;

/** A PR body whose Review section has a filled line for each reviewer. */
export function filledReview(value = 'no findings') {
  return ['## Review', '', ...REVIEWERS.map(({ label }) => `- **${label}:** ${value}`)].join('\n');
}

/** One transcript line: a background subagent handing back `report`. */
export function handbackLine(report: string) {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', name: 'SubagentHandback', input: { message: report } }],
    },
  });
}
