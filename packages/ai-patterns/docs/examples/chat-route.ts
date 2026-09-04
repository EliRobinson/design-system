/**
 * A chat route handler, whole. Drop it at `app/api/chat/route.ts`.
 *
 * The house voice, forwarded reasoning, forwarded sources and a safe error shape are all
 * in here — none of them written down. `model` is the one thing this file cannot supply:
 * the provider and the model id are the consumer's choice, so the real route imports
 * `anthropic('…')`, `openai('…')` or whatever it configured, and this example declares the
 * shape instead of picking one.
 *
 * Typechecked by the repo's own `tsc --noEmit` (tsconfig.typecheck.json includes
 * `packages/**`), so the six lines below cannot drift from the export map.
 */

import { convertToModelMessages, type LanguageModel, type UIMessage } from 'ai';

import { streamHouseText, toHouseUIMessageResponse } from '@elirobinson/ai-patterns/server';

declare const model: Exclude<LanguageModel, string>;

export async function POST(request: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await request.json();

  return toHouseUIMessageResponse(
    streamHouseText({ model, messages: await convertToModelMessages(messages) }),
  );
}
