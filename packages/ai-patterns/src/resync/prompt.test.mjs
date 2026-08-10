import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { promptSelections } from './prompt.mjs';

const ENTRIES = [
  { name: '@elirobinson/react', reference: '1.0.2', versions: ['1.0.2', '1.4.0', '2.0.0'] },
  { name: '@elirobinson/tokens', reference: '0.2.0', versions: ['0.2.0', '0.3.0'] },
];

function channels(answers) {
  const written = [];
  return {
    input: Readable.from(answers.map((line) => `${line}\n`)),
    output: { write: (text) => written.push(text) },
    written,
  };
}

describe('promptSelections', () => {
  it('accepts every package at the default target', async () => {
    const { input, output } = channels(['y', '', 'y', '']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.only).toEqual(['@elirobinson/react', '@elirobinson/tokens']);
    expect(result.targetSpec.byName).toEqual({
      '@elirobinson/react': 'latest',
      '@elirobinson/tokens': 'latest',
    });
  });

  it('records a per-package target', async () => {
    const { input, output } = channels(['y', 'minor', 'n']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.only).toEqual(['@elirobinson/react']);
    expect(result.targetSpec.byName).toEqual({ '@elirobinson/react': 'minor' });
  });

  it('declining everything yields an empty selection', async () => {
    const { input, output } = channels(['n', 'n']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.only).toEqual([]);
  });

  it('treats a bare newline as no', async () => {
    const { input, output } = channels(['', '']);
    expect((await promptSelections(ENTRIES, { input, output })).only).toEqual([]);
  });

  it('re-asks on an unrecognised target rather than guessing', async () => {
    const { input, output } = channels(['y', 'sideways', 'minor', 'n']);
    const result = await promptSelections(ENTRIES, { input, output });

    expect(result.targetSpec.byName).toEqual({ '@elirobinson/react': 'minor' });
  });

  it('shows the version transition in the question', async () => {
    const { input, output, written } = channels(['n', 'n']);
    await promptSelections(ENTRIES, { input, output });

    expect(written.join('')).toContain('1.0.2');
    expect(written.join('')).toContain('2.0.0');
  });

  it('skips a package with nothing newer', async () => {
    const { input, output } = channels(['n']);
    const entries = [
      { name: '@elirobinson/react', reference: '2.0.0', versions: ['1.0.0', '2.0.0'] },
      { name: '@elirobinson/tokens', reference: '0.2.0', versions: ['0.2.0', '0.3.0'] },
    ];
    const result = await promptSelections(entries, { input, output });

    expect(result.only).toEqual([]);
  });

  it('throws when the input ends partway through', async () => {
    const { input, output } = channels(['y']);
    await expect(promptSelections(ENTRIES, { input, output })).rejects.toThrow(/cancelled/);
  });
});
