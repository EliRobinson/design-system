/**
 * The house system prompt, rendered from `contracts.json → systemPromptStyle`.
 *
 * Hand-written, because this package ships `src` uncompiled. `prompt.types.test.mjs`
 * is what stops it lying about the runtime module.
 */

/** The shape `contracts.json → systemPromptStyle` has to hold for a prompt to render. */
export interface SystemPromptStyle {
  /** The voice, as one comma-separated phrase. */
  voice: string;
  /** What the model must not do. */
  forbidden: string[];
  /** What every response has to carry. */
  required: string[];
  /** What enforces each entry. Read by humans, never rendered into the prompt. */
  verifiedBy?: Record<string, string>;
}

export interface SystemPromptOptions {
  /**
   * The product's own instructions. Appended after the house voice, so it is
   * additive — a consumer can say more, never less.
   */
  append?: string;
}

export interface HouseSystemPromptOptions extends SystemPromptOptions {
  /** Read the style from somewhere other than this package's `contracts.json`. */
  path?: string;
}

/** The contract file this package publishes at `@elirobinson/ai-patterns/contracts`. */
export declare const CONTRACTS_PATH: string;

/** `systemPromptStyle`, as `contracts.json` currently declares it. */
export declare function readSystemPromptStyle(options?: { path?: string }): SystemPromptStyle;

/** A style object → the prompt text. Pure: no filesystem, no resolution. */
export declare function renderSystemPrompt(
  style: SystemPromptStyle,
  options?: SystemPromptOptions,
): string;

/** The house system prompt. Reads `contracts.json`, so it cannot go stale. */
export declare function houseSystemPrompt(options?: HouseSystemPromptOptions): string;
