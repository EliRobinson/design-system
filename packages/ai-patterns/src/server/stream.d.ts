/**
 * AI SDK Core with the house voice and the house stream defaults applied.
 *
 * Hand-written, because this package ships `src` uncompiled; `server.types.test.mjs`
 * compares these declarations against the module's real exports.
 *
 * Option types are derived from the installed `ai` rather than restated, so a setting the
 * SDK adds is available here without an edit — the same reason the CLI walks the package
 * instead of listing it.
 */

import type { CallSettings, LanguageModel, Prompt, ToolSet, streamText } from 'ai';

/**
 * A model, never a model id.
 *
 * `LanguageModel` admits a string, which the SDK resolves through its own gateway. That
 * makes the model choice ours by accident, so the string is excluded here and rejected at
 * runtime.
 */
export type HouseLanguageModel = Exclude<LanguageModel, string>;

/** A schema and the renderer that turns its output into component props. */
export interface HouseSurface<VALUE, RENDERED> {
  /** The dispatch key the renderer stamps onto its output. */
  kind: string;
  /** The `@elirobinson/react` component these props belong to. */
  component: string;
  schema: { parse(value: unknown): VALUE };
  render(value: unknown): RENDERED;
}

/**
 * `streamText`'s own options, with the model narrowed.
 *
 * `system` keeps its SDK meaning of "instructions", but here it is *added to* the house
 * voice rather than replacing it.
 */
export type HouseTextOptions<TOOLS extends ToolSet = ToolSet> = Parameters<
  typeof streamText<TOOLS>
>[0] & {
  model: HouseLanguageModel;
};

/** What the object helpers accept: a surface instead of a schema. */
export type HouseSurfaceOptions<VALUE, RENDERED> = CallSettings &
  Prompt & {
    surface: HouseSurface<VALUE, RENDERED>;
    model: HouseLanguageModel;
  };

/** Anything that can turn itself into a UI message stream response. */
export interface UIMessageStreamable<OPTIONS extends object> {
  toUIMessageStreamResponse(options?: OPTIONS): Response;
}

/** The `LanguageModel` the consumer built, or a `TypeError` naming the fix. */
export declare function assertLanguageModel(model: unknown): HouseLanguageModel;

/** An error → one sentence a page can show. Never the underlying message. */
export declare function shapeStreamError(error: unknown): string;

/** `streamText`, with the house system prompt already applied. */
export declare function streamHouseText<TOOLS extends ToolSet = ToolSet>(
  options: HouseTextOptions<TOOLS>,
): ReturnType<typeof streamText<TOOLS>>;

/** `toUIMessageStreamResponse()` with reasoning, sources, and a safe error shape. */
export declare function toHouseUIMessageResponse<OPTIONS extends object>(
  result: UIMessageStreamable<OPTIONS>,
  options?: OPTIONS,
): Response;

/** `generateObject` for a structured surface, with the rendered props alongside. */
export declare function generateHouseSurface<VALUE, RENDERED>(
  options: HouseSurfaceOptions<VALUE, RENDERED>,
): Promise<{ object: VALUE; rendered: RENDERED } & Record<string, unknown>>;

/** `streamObject` for a structured surface. Render `result.object` when it resolves. */
export declare function streamHouseSurface<VALUE, RENDERED>(
  options: HouseSurfaceOptions<VALUE, RENDERED>,
): { object: Promise<VALUE> } & Record<string, unknown>;
