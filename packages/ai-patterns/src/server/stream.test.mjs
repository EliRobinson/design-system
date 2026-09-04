// End to end against the SDK's own mock model, not against a spy on our own
// call. The claim this file has to settle is that the voice in contracts.json
// reaches the provider — and a spy asserting "we passed `system`" would pass
// just as happily if the SDK stopped forwarding it.
//
// `MockLanguageModelV4` records every call it receives, so the assertion is on
// the message the model was actually handed.

import { readFileSync } from 'node:fs';

import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';

import { CONTRACTS_PATH, houseSystemPrompt } from './prompt.mjs';
import {
  assertLanguageModel,
  generateHouseSurface,
  shapeStreamError,
  streamHouseText,
  toHouseUIMessageResponse,
} from './stream.mjs';
import { decisionCardSurface } from './surfaces/decision-card.mjs';

const style = JSON.parse(readFileSync(CONTRACTS_PATH, 'utf8')).systemPromptStyle;

function textModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'ok' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ],
      }),
    }),
  });
}

function systemMessageOf(call) {
  return call.prompt.find((message) => message.role === 'system')?.content;
}

describe('streamHouseText', () => {
  it('hands the model the voice contracts.json declares', async () => {
    const model = textModel();
    await streamHouseText({ model, prompt: 'Should we migrate?' }).text;

    const system = systemMessageOf(model.doStreamCalls[0]);

    expect(system).toBe(houseSystemPrompt());
    expect(system).toContain(style.voice);
    for (const entry of [...style.forbidden, ...style.required]) {
      expect(system).toContain(entry);
    }
  });

  /* The whole reason the wrapper exists: a consumer says more, never less. If
     `system` replaced the house prompt, bumping a version would stop changing
     anything and every route would have to be edited by hand. */
  it('appends the product’s own instructions rather than replacing the voice', async () => {
    const model = textModel();
    await streamHouseText({ model, prompt: 'Should we migrate?', system: 'Only invoices.' }).text;

    const system = systemMessageOf(model.doStreamCalls[0]);

    expect(system).toContain(style.voice);
    expect(system.indexOf('Only invoices.')).toBeGreaterThan(system.indexOf(style.voice));
  });

  it('passes every other option through untouched', async () => {
    const model = textModel();
    await streamHouseText({ model, prompt: 'Should we migrate?', temperature: 0.1 }).text;

    expect(model.doStreamCalls[0].temperature).toBe(0.1);
  });
});

describe('assertLanguageModel', () => {
  /* `LanguageModel` accepts a model id, and the SDK resolves it through its own
     gateway — so the quiet failure is our package choosing a route the consumer
     never picked. Each rejection names the fix. */
  it('refuses a model id string, naming the call that fixes it', () => {
    expect(() => assertLanguageModel('anthropic/claude-sonnet-4')).toThrow('provider(id)');
  });

  it('refuses a provider that has not been called yet', () => {
    expect(() => assertLanguageModel({ languageModel: () => {} })).toThrow('provider, not a model');
    expect(() => assertLanguageModel(() => {})).toThrow('provider, not a model');
  });

  it('refuses anything the SDK would not recognise either', () => {
    expect(() => assertLanguageModel({ modelId: 'x' })).toThrow('specificationVersion');
    expect(() => assertLanguageModel(undefined)).toThrow('specificationVersion');
  });

  it('returns a real model unchanged', () => {
    const model = textModel();
    expect(assertLanguageModel(model)).toBe(model);
  });

  it('is enforced before the SDK is ever called', () => {
    expect(() => streamHouseText({ model: 'anthropic/claude-sonnet-4', prompt: 'hi' })).toThrow(
      TypeError,
    );
  });
});

describe('toHouseUIMessageResponse', () => {
  function recorder() {
    const calls = [];
    return {
      calls,
      result: {
        toUIMessageStreamResponse(options) {
          calls.push(options);
          return new Response('ok');
        },
      },
    };
  }

  it('forwards reasoning and sources, which the SDK does not do by default', () => {
    const { calls, result } = recorder();
    toHouseUIMessageResponse(result);

    expect(calls[0].sendReasoning).toBe(true);
    expect(calls[0].sendSources).toBe(true);
  });

  it('shapes errors instead of leaving them to the SDK’s empty default', () => {
    const { calls, result } = recorder();
    toHouseUIMessageResponse(result);

    expect(calls[0].onError(new Error('connect ECONNREFUSED 10.0.0.4:443'))).toBe(
      shapeStreamError(new Error('connect ECONNREFUSED 10.0.0.4:443')),
    );
  });

  it('lets a consumer override any of it', () => {
    const { calls, result } = recorder();
    toHouseUIMessageResponse(result, { sendReasoning: false });

    expect(calls[0].sendReasoning).toBe(false);
    expect(calls[0].sendSources).toBe(true);
  });

  it('returns the response the SDK built', async () => {
    const { result } = recorder();
    expect(await toHouseUIMessageResponse(result).text()).toBe('ok');
  });
});

describe('shapeStreamError', () => {
  /* The message is written for a server log. It routinely carries a host, a
     request id, or part of a key, and none of that may reach a browser. */
  it('never returns anything from the error it was given', () => {
    const error = new Error('401 from https://api.example.com with key sk-live-abcdef');

    expect(shapeStreamError(error)).not.toContain('sk-live');
    expect(shapeStreamError(error)).not.toContain('api.example.com');
  });

  it('says what happened and what to do, and stops', () => {
    expect(shapeStreamError(new Error('boom'))).toBe(
      'The model call failed. Send the message again.',
    );

    const aborted = new Error('aborted');
    aborted.name = 'AbortError';
    expect(shapeStreamError(aborted)).toBe(
      'The response stopped before it finished. Send the message again.',
    );
  });
});

describe('generateHouseSurface', () => {
  const value = {
    verdict: 'go',
    verdictLabel: 'Go',
    headline: 'The migration pays for itself in four months.',
  };

  function objectModel(text) {
    return new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text }],
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        warnings: [],
      }),
    });
  }

  it('applies the same house voice the text helper does', async () => {
    const model = objectModel(JSON.stringify(value));
    await generateHouseSurface({
      surface: decisionCardSurface,
      model,
      prompt: 'Should we migrate?',
    });

    expect(systemMessageOf(model.doGenerateCalls[0])).toBe(houseSystemPrompt());
  });

  it('returns the component props alongside the object, with nothing to map', async () => {
    const result = await generateHouseSurface({
      surface: decisionCardSurface,
      model: objectModel(JSON.stringify(value)),
      prompt: 'Should we migrate?',
    });

    expect(result.object).toEqual(value);
    expect(result.rendered).toEqual({
      kind: 'decision-card',
      component: 'DecisionCard',
      props: value,
    });
  });

  it('refuses anything that is not one of this package’s surfaces', async () => {
    await expect(
      generateHouseSurface({
        surface: { schema: decisionCardSurface.schema },
        model: objectModel('{}'),
        prompt: 'Should we migrate?',
      }),
    ).rejects.toThrow('structured surfaces');
  });
});
