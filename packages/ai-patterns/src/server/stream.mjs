/* AI SDK Core, with the house voice and the house stream defaults already applied.
 *
 * The vendored UI renders whatever the stream contains. It has nothing to say about what
 * the model was told or how an error reaches the page, and that half is ours — so it lives
 * here, next to the contracts, rather than being copied into every route handler.
 *
 * Three things this wrapper is, and one it deliberately is not:
 *
 *   - It applies `contracts.json → systemPromptStyle`, via `./prompt.mjs`. A consumer's
 *     own `system` string is *appended* to it, never substituted for it. That is the only
 *     arrangement in which bumping a version keeps a consumer current.
 *   - It sets the `toUIMessageStreamResponse` defaults the vendored components expect:
 *     reasoning forwarded, sources forwarded, and errors shaped into a sentence that is
 *     safe to render. The SDK's own default swallows the error into "An error occurred",
 *     and the obvious fix — forwarding `error.message` — is how a provider URL or a key
 *     fragment reaches a browser.
 *   - It refuses a model-id string. `LanguageModel` accepts one, and the string resolves
 *     through a gateway the consumer did not choose. Model choice is theirs; taking it
 *     silently is worse than failing.
 *
 * What it is not: a place that names a model, a provider, or a version. `ai` is a peer
 * dependency for the same reason — two copies of the SDK in one process is a class of bug
 * nobody can debug from the outside.
 */

import { generateObject, streamObject, streamText } from 'ai';

import { houseSystemPrompt } from './prompt.mjs';

/**
 * The `LanguageModel` the consumer built, or a clear failure.
 *
 * Three rejections, each naming the fix, because all three are things a reader can
 * reasonably think will work:
 *
 *   - a string, which the SDK accepts and routes through its gateway;
 *   - a provider (`anthropic`, `openai`), one call short of a model;
 *   - anything else, which fails much deeper in the SDK with a message about the request
 *     body rather than about the argument.
 */
export function assertLanguageModel(model) {
  if (typeof model === 'string') {
    throw new TypeError(
      `A model id string ("${model}") routes through the SDK's gateway rather than through ` +
        'the provider you configured. Pass the model itself — `provider(id)` — so the ' +
        'choice stays yours.',
    );
  }

  if (typeof model === 'function' || typeof model?.languageModel === 'function') {
    throw new TypeError(
      'That is a provider, not a model. Call it with the model id you want — ' +
        '`provider(id)` — and pass the result.',
    );
  }

  if (model === null || typeof model !== 'object' || model.specificationVersion === undefined) {
    throw new TypeError(
      '`model` must be a LanguageModel from your provider. It has no `specificationVersion`, ' +
        'so the AI SDK will not recognise it either.',
    );
  }

  return model;
}

/**
 * An error → one sentence a page can show.
 *
 * Chrome copy, so it follows the rule in `patterns.md`: the fact, then the action, and
 * stop. No apology, no frequency claim, no blame. Never the underlying message — that
 * text is written for a server log and routinely carries a URL, a request id, or part of
 * a key.
 */
export function shapeStreamError(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return 'The response stopped before it finished. Send the message again.';
  }
  return 'The model call failed. Send the message again.';
}

/**
 * `streamText`, with the house system prompt already applied.
 *
 * `system` is the product's own instructions and is appended to the house voice. Every
 * other option is the SDK's and is passed through untouched — including `tools`, whose
 * display metadata `./tools.mjs` carries separately.
 */
export function streamHouseText({ model, system, ...options }) {
  return streamText({
    ...options,
    model: assertLanguageModel(model),
    system: houseSystemPrompt({ append: system }),
  });
}

/**
 * `result.toUIMessageStreamResponse()`, with the defaults the vendored components expect.
 *
 * Every default is overridable: pass `sendReasoning: false` and it is off. What a
 * consumer cannot do by accident is ship the SDK's bare defaults, which forward neither
 * reasoning nor sources and hand the page an error string with nothing in it.
 */
export function toHouseUIMessageResponse(result, options = {}) {
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    sendSources: true,
    onError: shapeStreamError,
    ...options,
  });
}

/* The two object helpers below wrap `generateObject` / `streamObject`, which AI SDK 7
   deprecates in favour of `streamText`'s `output` setting. That is exactly why they are
   wrapped: the call is written once here, so the migration is a version bump for every
   consumer rather than an edit in every route. The wrapper's own signature — a surface,
   a model, a prompt — has no reason to change when the call underneath it does. */

function assertSurface(surface) {
  if (
    surface === null ||
    typeof surface !== 'object' ||
    typeof surface.render !== 'function' ||
    surface.schema === undefined
  ) {
    throw new TypeError(
      "`surface` must be one of this package's structured surfaces — `decisionCardSurface`, " +
        '`verdictBadgeSurface` or `stubCardSurface`, each published under ' +
        '`@elirobinson/ai-patterns/server/surfaces/…` — which carries both a schema and its ' +
        'renderer.',
    );
  }
  return surface;
}

/**
 * `generateObject` for one of the structured surfaces this system owns.
 *
 * Returns the SDK's result with `rendered` alongside it: the props the matching component
 * takes, with nothing left to map. `schemaName` is set from the surface so a provider that
 * shows the schema to the model shows it a name a person wrote.
 */
export async function generateHouseSurface({ surface, model, system, ...options }) {
  const chosen = assertSurface(surface);

  const result = await generateObject({
    ...options,
    model: assertLanguageModel(model),
    schema: chosen.schema,
    schemaName: chosen.component,
    system: houseSystemPrompt({ append: system }),
  });

  return { ...result, rendered: chosen.render(result.object) };
}

/**
 * `streamObject` for one of the structured surfaces this system owns.
 *
 * The SDK's result is returned as-is — partial objects are partial by definition and
 * cannot be validated mid-flight. Render the finished object with the surface's own
 * `render` once `result.object` resolves.
 */
export function streamHouseSurface({ surface, model, system, ...options }) {
  const chosen = assertSurface(surface);

  return streamObject({
    ...options,
    model: assertLanguageModel(model),
    schema: chosen.schema,
    schemaName: chosen.component,
    system: houseSystemPrompt({ append: system }),
  });
}
