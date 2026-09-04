/**
 * Display metadata for AI SDK tools — the layer `tool()` has no room for.
 *
 * Hand-written, because this package ships `src` uncompiled. `server.types.test.mjs`
 * compares these declarations against the module's real exports.
 */

/** Where a display record hangs off a tool definition. */
export declare const TOOL_DISPLAY: unique symbol;

/** What a person should see for a tool. Written for a reader, not for the model. */
export interface ToolDisplay {
  /** The name a tool panel leads with, e.g. "Search the catalogue". */
  label: string;
  /** One line of context, for a tooltip or a second row. */
  description?: string;
  /** What the panel says while the tool is running, e.g. "Searching the catalogue". */
  runningLabel?: string;
}

/** A display record as it crosses to the client: plain JSON, and honest about its origin. */
export type ToolDisplayRecord = ToolDisplay & {
  /** `declared` came from `withToolDisplay`; `fallback` was derived from the tool name. */
  source: 'declared' | 'fallback';
};

/** A tool set → one record per tool, keyed by the name the stream carries. */
export type ToolDisplayManifest = Record<string, ToolDisplayRecord>;

/** `camelCase` / `snake_case` / `kebab-case` → a readable phrase. */
export declare function humanizeToolName(name: string): string;

/** A tool definition plus the words a person should see for it. Does not mutate it. */
export declare function withToolDisplay<TOOL extends object>(
  toolDefinition: TOOL,
  display: ToolDisplay,
): TOOL;

/** The display record attached to a tool definition, or `null` when it has none. */
export declare function toolDisplay(toolDefinition: unknown): ToolDisplay | null;

/** A tool set → the serialisable manifest a client bundle can hold. */
export declare function toolDisplayManifest(tools: Record<string, unknown>): ToolDisplayManifest;

/** The label a panel shows for `name`. Never returns a raw identifier. */
export declare function toolDisplayName(
  manifest: ToolDisplayManifest | undefined,
  name: string,
): string;
