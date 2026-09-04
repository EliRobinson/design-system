/**
 * The structured half: a route that returns one of the surfaces this system owns.
 *
 * `rendered.props` is the props object `<DecisionCard>` takes. There is no mapping step on
 * either side of the wire — that is the whole claim, and it is why the schema and the
 * renderer ship from the same subpath.
 */

import type { LanguageModel } from 'ai';

import { generateHouseSurface } from '@elirobinson/ai-patterns/server';
import { decisionCardSurface } from '@elirobinson/ai-patterns/server/surfaces/decision-card';

declare const model: Exclude<LanguageModel, string>;

export async function POST(request: Request): Promise<Response> {
  const { question }: { question: string } = await request.json();

  const { rendered } = await generateHouseSurface({
    surface: decisionCardSurface,
    model,
    prompt: question,
  });

  return Response.json(rendered);
}
