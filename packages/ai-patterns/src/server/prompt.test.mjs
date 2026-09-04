// The house system prompt has one job that no type and no runtime check would
// catch on its own: it must be *derived* from contracts.json rather than a copy
// of it that happens to agree today. A prompt that has drifted still compiles,
// still streams, and still reads plausibly — the only symptom is a model that
// stopped following the contract the rest of the package enforces.
//
// So this file checks the derivation from both ends. Forwards: every value in
// `systemPromptStyle` appears in the rendered prompt. Backwards: none of those
// values appears in prompt.mjs itself, which is what makes the first assertion
// mean something. A literal copy would satisfy the first and fail the second.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CONTRACTS_PATH,
  houseSystemPrompt,
  readSystemPromptStyle,
  renderSystemPrompt,
} from './prompt.mjs';

const contracts = JSON.parse(readFileSync(CONTRACTS_PATH, 'utf8'));
const style = contracts.systemPromptStyle;

const moduleSource = readFileSync(fileURLToPath(new URL('./prompt.mjs', import.meta.url)), 'utf8');
const declarationSource = readFileSync(
  fileURLToPath(new URL('./prompt.d.ts', import.meta.url)),
  'utf8',
);

describe('CONTRACTS_PATH', () => {
  it('is the file this package publishes as `./contracts`', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    );
    const published = fileURLToPath(
      new URL(`../../${manifest.exports['./contracts']}`, import.meta.url),
    );

    expect(CONTRACTS_PATH).toBe(published);
  });
});

describe('the house system prompt', () => {
  const prompt = houseSystemPrompt();

  it('reads the style straight out of contracts.json', () => {
    expect(readSystemPromptStyle()).toEqual(style);
  });

  it('carries the voice contracts.json declares', () => {
    expect(prompt).toContain(style.voice);
  });

  it.each(style.forbidden)('carries the forbidden entry %s', (entry) => {
    expect(prompt).toContain(entry);
  });

  it.each(style.required)('carries the required entry %s', (entry) => {
    expect(prompt).toContain(entry);
  });

  /* The half that makes the assertions above worth having. `verifiedBy` is
     excluded: it names what enforces a constraint for a human reader and is not
     an instruction to a model, so it is deliberately not rendered. */
  it.each([style.voice, ...style.forbidden, ...style.required])(
    'does not hardcode %s anywhere in the module or its declarations',
    (value) => {
      expect(
        moduleSource.includes(value),
        `prompt.mjs contains "${value}" as a literal — the prompt has to be read from ` +
          'contracts.json, or a consumer who bumps a version does not get the new voice',
      ).toBe(false);
      expect(declarationSource.includes(value)).toBe(false);
    },
  );

  it('renders whatever style it is handed, not the one it shipped with', () => {
    const fabricated = {
      voice: 'terse, sceptical',
      forbidden: ['adjectives'],
      required: ['a citation'],
    };

    const rendered = renderSystemPrompt(fabricated);

    expect(rendered).toContain('terse, sceptical');
    expect(rendered).toContain('adjectives');
    expect(rendered).toContain('a citation');
    expect(rendered).not.toContain(style.voice);
  });
});

describe('a product’s own instructions', () => {
  it('are appended after the house voice, never in place of it', () => {
    const prompt = houseSystemPrompt({ append: 'Answer only about invoices.' });

    expect(prompt).toContain(style.voice);
    expect(prompt.indexOf('Answer only about invoices.')).toBeGreaterThan(
      prompt.indexOf(style.voice),
    );
  });

  it('change nothing when blank', () => {
    expect(houseSystemPrompt({ append: '   ' })).toBe(houseSystemPrompt());
    expect(houseSystemPrompt({ append: undefined })).toBe(houseSystemPrompt());
  });
});

describe('a malformed style', () => {
  it.each(['voice', 'forbidden', 'required'])('fails loudly when %s is missing', (field) => {
    const broken = { ...style };
    delete broken[field];

    expect(() => renderSystemPrompt(broken)).toThrow(field);
  });

  it('fails loudly when a list is empty rather than rendering a prompt with a hole', () => {
    expect(() => renderSystemPrompt({ ...style, forbidden: [] })).toThrow('non-empty');
  });

  it('names the file when contracts.json cannot be read', () => {
    expect(() => readSystemPromptStyle({ path: '/nonexistent/contracts.json' })).toThrow(
      '/nonexistent/contracts.json',
    );
  });
});
