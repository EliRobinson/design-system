/* `VerdictBadge` as a model output: the schema and its renderer, together.
 *
 * `glyph` is excluded. The component draws ✓ / ✕ / ◑ for the three verdicts precisely so
 * the badge never signals by colour alone (SC 1.4.1), and those marks are not copy a
 * product — or a model — has to own. `label` is, and it is required.
 */

import { z } from 'zod';

/** The three verdicts the badge draws a mark for. */
export const verdictSchema = z.enum(['go', 'no', 'hold']);

/** What a model must produce for a `VerdictBadge`. */
export const verdictBadgeSchema = z.object({
  verdict: verdictSchema.describe('The decision itself.'),
  label: z.string().min(1).describe('The verdict as a word — the accessible text.'),
});

/** A validated object → the props `<VerdictBadge>` takes, with nothing to map. */
export function renderVerdictBadge(value) {
  return {
    kind: 'verdict-badge',
    component: 'VerdictBadge',
    props: verdictBadgeSchema.parse(value),
  };
}

/** The schema and its renderer, as one thing the object helpers accept. */
export const verdictBadgeSurface = {
  kind: 'verdict-badge',
  component: 'VerdictBadge',
  schema: verdictBadgeSchema,
  render: renderVerdictBadge,
};
