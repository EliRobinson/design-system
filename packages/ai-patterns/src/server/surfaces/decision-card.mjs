/* `DecisionCard` as a model output: the schema and its renderer, together.
 *
 * This is one of the three structured surfaces the system owns outright — there is no
 * Elements equivalent to defer to, so the schema *is* the contract between a model and a
 * component we ship. Keeping the schema in one file and the renderer in another would
 * make it possible to import half of it; a consumer needs both or neither.
 *
 * The schema is the model-authorable subset of `DecisionCardProps`, and the two exclusions
 * are deliberate rather than accidental:
 *
 *   - `action` is a `ReactNode`. A model cannot produce one, and a card whose action is
 *     generated is a card that can invent a destination.
 *   - `headingLevel` is the document outline, which belongs to the page the card sits in.
 *     A model has no view of that, and the component defaults it to 2.
 *
 * `surfaces.test.mjs` cross-checks every key here against `@elirobinson/react`'s manifest,
 * so a prop that moves fails this package's suite rather than a consumer's render.
 */

import { z } from 'zod';

const line = z.string().min(1);

/** A labelled figure the card lists behind its verdict. */
export const decisionFigureSchema = z.object({
  label: line,
  value: line,
  kind: line.optional(),
});

const labelledValue = z.object({ label: line, value: line });

/** What a model must produce for a `DecisionCard`. */
export const decisionCardSchema = z.object({
  verdict: z.enum(['go', 'no', 'hold']).describe('The decision itself.'),
  verdictLabel: line.describe('The verdict as a word, e.g. "Go". Never colour alone.'),
  headline: line.describe('The decision in one sentence.'),
  subject: line.optional().describe('What the decision is about.'),
  figures: z.array(decisionFigureSchema).optional().describe('The numbers behind the verdict.'),
  total: labelledValue.optional().describe('The figure the others add up to.'),
  contrast: labelledValue.optional().describe('The figure the total is being weighed against.'),
  caveat: line.optional().describe('What would change this verdict.'),
  closing: line.optional().describe('The next step, stated plainly.'),
});

/**
 * A validated object → the props `<DecisionCard>` takes, with nothing to map.
 *
 * `props` is separate from `kind` on purpose: `DecisionCard` spreads its rest props onto a
 * `<div>`, so a dispatch key mixed into them would land in the DOM as an unknown
 * attribute.
 */
export function renderDecisionCard(value) {
  return {
    kind: 'decision-card',
    component: 'DecisionCard',
    props: decisionCardSchema.parse(value),
  };
}

/** The schema and its renderer, as one thing the object helpers accept. */
export const decisionCardSurface = {
  kind: 'decision-card',
  component: 'DecisionCard',
  schema: decisionCardSchema,
  render: renderDecisionCard,
};
