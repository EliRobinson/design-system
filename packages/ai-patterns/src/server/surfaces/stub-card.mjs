/* `StubCard` as a model output: the schema and its renderer, together.
 *
 * `items` is required and non-empty. The component renders it as a `<dl>`, and a
 * description list with no rows is a card with a hole in it — the kind of output that
 * renders without error and reads as a bug.
 */

import { z } from 'zod';

const line = z.string().min(1);

/** One labelled row in the stub's body column. */
export const stubCardItemSchema = z.object({ label: line, value: line });

/** What a model must produce for a `StubCard`. */
export const stubCardSchema = z.object({
  title: line.describe('What the stub is a summary of.'),
  items: z.array(stubCardItemSchema).min(1).describe('The labelled rows in the body column.'),
  stubLabel: line.describe('The label on the torn-off stub column.'),
  stubValue: line.describe('The value on the torn-off stub column — the figure that matters.'),
  stubCaption: line.optional().describe('One line under the stub value.'),
  footnote: line.optional().describe('One line under the body rows.'),
});

/** A validated object → the props `<StubCard>` takes, with nothing to map. */
export function renderStubCard(value) {
  return {
    kind: 'stub-card',
    component: 'StubCard',
    props: stubCardSchema.parse(value),
  };
}

/** The schema and its renderer, as one thing the object helpers accept. */
export const stubCardSurface = {
  kind: 'stub-card',
  component: 'StubCard',
  schema: stubCardSchema,
  render: renderStubCard,
};
