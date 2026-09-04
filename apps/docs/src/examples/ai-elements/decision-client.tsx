'use client';

/**
 * The client end of a structured surface. `decision-route.ts` is the server end.
 *
 * The route returns `rendered`, which is `{ kind, component, props }`. `props`
 * is the props object `<DecisionCard>` takes, so there is no mapping step here
 * and none on the server — that is the claim the surface makes, and it is why
 * the schema and the renderer ship from the same subpath.
 *
 * `kind` is the dispatch key, kept apart from the props on purpose: a page that
 * can render more than one surface switches on it, and never has to guess a
 * component from the shape of an object.
 *
 * Note where this one comes from. A structured surface is a component the system
 * owns, from `@elirobinson/react` — it carries the keyboard contract and the
 * stylesheet, and it is not vendored. AI Elements is the conversational chrome
 * around it.
 */

import { useState } from 'react';

import type { RenderedDecisionCard } from '@elirobinson/ai-patterns/server/surfaces/decision-card';
import { DecisionCard } from '@elirobinson/react/components/molecules/DecisionCard';

export function DecisionAnswer({ endpoint }: { endpoint: string }) {
  const [rendered, setRendered] = useState<RenderedDecisionCard | null>(null);

  async function ask(question: string) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    setRendered((await response.json()) as RenderedDecisionCard);
  }

  if (rendered === null) {
    return (
      <button onClick={() => ask('Should we move the launch to March?')} type="button">
        Ask
      </button>
    );
  }

  return <DecisionCard {...rendered.props} />;
}
