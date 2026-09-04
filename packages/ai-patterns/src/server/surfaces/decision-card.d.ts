/**
 * `DecisionCard` as a model output. Hand-written, because this package ships `src`
 * uncompiled; `server.types.test.mjs` compares it against the real module.
 */

import type { z } from 'zod';

export interface DecisionFigure {
  label: string;
  value: string;
  kind?: string;
}

export interface LabelledValue {
  label: string;
  value: string;
}

/** The model-authorable subset of `DecisionCardProps`. */
export interface DecisionCardValue {
  verdict: 'go' | 'no' | 'hold';
  verdictLabel: string;
  headline: string;
  subject?: string;
  figures?: DecisionFigure[];
  total?: LabelledValue;
  contrast?: LabelledValue;
  caveat?: string;
  closing?: string;
}

/** What `render` hands the client: a dispatch key and the props, kept apart. */
export interface RenderedDecisionCard {
  kind: 'decision-card';
  component: 'DecisionCard';
  props: DecisionCardValue;
}

export declare const decisionFigureSchema: z.ZodType<DecisionFigure>;
export declare const decisionCardSchema: z.ZodType<DecisionCardValue>;

/** A validated object → the props `<DecisionCard>` takes. Throws on anything else. */
export declare function renderDecisionCard(value: unknown): RenderedDecisionCard;

/** The schema and its renderer, as one thing the object helpers accept. */
export declare const decisionCardSurface: {
  kind: 'decision-card';
  component: 'DecisionCard';
  schema: z.ZodType<DecisionCardValue>;
  render: (value: unknown) => RenderedDecisionCard;
};
