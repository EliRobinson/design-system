/**
 * `StubCard` as a model output. Hand-written, because this package ships `src`
 * uncompiled; `server.types.test.mjs` compares it against the real module.
 */

import type { z } from 'zod';

export interface StubCardItem {
  label: string;
  value: string;
}

/** The model-authorable subset of `StubCardProps`. */
export interface StubCardValue {
  title: string;
  items: StubCardItem[];
  stubLabel: string;
  stubValue: string;
  stubCaption?: string;
  footnote?: string;
}

/** What `render` hands the client: a dispatch key and the props, kept apart. */
export interface RenderedStubCard {
  kind: 'stub-card';
  component: 'StubCard';
  props: StubCardValue;
}

export declare const stubCardItemSchema: z.ZodType<StubCardItem>;
export declare const stubCardSchema: z.ZodType<StubCardValue>;

/** A validated object → the props `<StubCard>` takes. Throws on anything else. */
export declare function renderStubCard(value: unknown): RenderedStubCard;

/** The schema and its renderer, as one thing the object helpers accept. */
export declare const stubCardSurface: {
  kind: 'stub-card';
  component: 'StubCard';
  schema: z.ZodType<StubCardValue>;
  render: (value: unknown) => RenderedStubCard;
};
