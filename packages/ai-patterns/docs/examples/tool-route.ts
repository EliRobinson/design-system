/**
 * A chat route with one tool, and the words a person should see for it.
 *
 * `tool()` has room for a description written for the *model* and a schema, and
 * that is all — the name the stream carries is whatever key the tool set was
 * declared under. So a tool panel rendering that stream has nothing human to
 * lead with, and shows `searchCatalogue` to a reader. `withToolDisplay` attaches
 * the label beside the tool, where the person who named it is already looking,
 * and returns a new object rather than mutating the definition.
 *
 * `toolDisplayManifest` turns the set into plain JSON — no symbols, no schemas,
 * no functions — which is what a client bundle can hold. A tool with no declared
 * display still gets a record, marked `source: 'fallback'` and labelled from its
 * function name, so a panel never has to branch on absence.
 *
 * Typechecked by the repo's own `tsc --noEmit`, like the two routes beside it.
 */

import { tool, type LanguageModel, type ModelMessage } from 'ai';
import { z } from 'zod';

import { streamHouseText, toHouseUIMessageResponse } from '@elirobinson/ai-patterns/server';
import { toolDisplayManifest, withToolDisplay } from '@elirobinson/ai-patterns/server/tools';

declare const model: Exclude<LanguageModel, string>;
declare function searchCatalogue(query: string, limit: number): Promise<string[]>;

/* Not exported. The tool set holds the schemas and the `execute` functions, so
   the only thing that should leave this module is the manifest below. (It also
   keeps `tsc` quiet: the SDK's inferred tool type is not nameable from outside
   its own package, so exporting this would demand a hand-written annotation
   that throws away the very inference `tool()` exists to give.) */
const tools = {
  searchCatalogue: withToolDisplay(
    tool({
      description: 'Search the product catalogue and return matching product names.',
      inputSchema: z.object({
        query: z.string().describe('What to search for.'),
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: ({ query, limit }) => searchCatalogue(query, limit),
    }),
    {
      label: 'Search the catalogue',
      description: 'Looks products up by name.',
      runningLabel: 'Searching the catalogue',
    },
  ),
};

/** The half that crosses to the client. Serialisable by construction. */
export const toolDisplay = toolDisplayManifest(tools);

export async function POST(request: Request): Promise<Response> {
  const { messages }: { messages: ModelMessage[] } = await request.json();

  return toHouseUIMessageResponse(streamHouseText({ model, messages, tools }));
}
