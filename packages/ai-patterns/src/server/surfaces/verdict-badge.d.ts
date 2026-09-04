/**
 * `VerdictBadge` as a model output. Hand-written, because this package ships `src`
 * uncompiled; `server.types.test.mjs` compares it against the real module.
 */

import type { z } from 'zod';

export type Verdict = 'go' | 'no' | 'hold';

/** The model-authorable subset of `VerdictBadgeProps`. */
export interface VerdictBadgeValue {
  verdict: Verdict;
  label: string;
}

/** What `render` hands the client: a dispatch key and the props, kept apart. */
export interface RenderedVerdictBadge {
  kind: 'verdict-badge';
  component: 'VerdictBadge';
  props: VerdictBadgeValue;
}

export declare const verdictSchema: z.ZodType<Verdict>;
export declare const verdictBadgeSchema: z.ZodType<VerdictBadgeValue>;

/** A validated object → the props `<VerdictBadge>` takes. Throws on anything else. */
export declare function renderVerdictBadge(value: unknown): RenderedVerdictBadge;

/** The schema and its renderer, as one thing the object helpers accept. */
export declare const verdictBadgeSurface: {
  kind: 'verdict-badge';
  component: 'VerdictBadge';
  schema: z.ZodType<VerdictBadgeValue>;
  render: (value: unknown) => RenderedVerdictBadge;
};
