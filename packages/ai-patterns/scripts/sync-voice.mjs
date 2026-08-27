#!/usr/bin/env node
/* Writes every surface derived from the voice pack.
 *
 * The word lists lived in hand-kept copies that disagreed — the fullest reached agents
 * and the shortest reached humans. One source, written out; `--check` is the CI form.
 *
 * Three surfaces, and each is written whole rather than patched:
 *
 *   design-system-docs/README.md                    the `name="voice"` managed block
 *   design-system-docs/guidelines/brand-voice.html  the card the design project renders
 *   packages/ai-patterns/src/contracts.json         the tone line agents are given
 *
 * contracts.json is hand-authored and checked in — build-artifacts.mjs reads it and
 * embeds it in the packed corpus, and nothing else writes it — so this is its one
 * generator rather than a second one. Only the tone line comes from the pack, so only
 * that string is replaced: re-serialising the file with JSON.stringify reflows every
 * short array onto its own lines, prettier collapses them again on commit, and
 * `--check` then fails forever on a file nobody edited.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { replaceManagedBlock } from '../src/artifacts/brand.mjs';
import { renderVoice, renderVoiceCard, toneSummary } from '../src/voice/render.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const at = (path) => join(repo, path);
const PACK = 'design-system-docs/miltinson.voice.json';
const pack = JSON.parse(readFileSync(at(PACK), 'utf8'));

const README = 'design-system-docs/README.md';
const CARD = 'design-system-docs/guidelines/brand-voice.html';
const CONTRACTS = 'packages/ai-patterns/src/contracts.json';

const GENERATED_NOTE = `<!-- Generated from ${PACK}. Do not edit. -->`;

function readmeWithVoice() {
  return replaceManagedBlock(
    readFileSync(at(README), 'utf8'),
    renderVoice(pack),
    README,
    GENERATED_NOTE,
    'voice',
  );
}

function contractsWithTone() {
  const source = readFileSync(at(CONTRACTS), 'utf8');
  const tone = toneSummary(pack);
  /* Anchored on the key that opens `systemPromptStyle`, because `verifiedBy`
     holds a second `"voice"` and an unanchored replace would overwrite the
     wrong one. */
  const next = source.replace(
    /("systemPromptStyle"\s*:\s*\{\s*"voice"\s*:\s*)"(?:[^"\\]|\\.)*"/,
    (_, prefix) => prefix + JSON.stringify(tone),
  );
  /* Re-read rather than trust the regex: a surgical edit that silently missed
     is the one failure mode this approach has, and a stale tone line is
     exactly what the pack exists to end. */
  const parsed = JSON.parse(next);
  if (parsed.systemPromptStyle?.voice !== tone) {
    throw new Error(
      `${CONTRACTS}: could not rewrite systemPromptStyle.voice — the key moved or ` +
        'was reformatted. Fix the anchor in sync-voice.mjs rather than the contract.',
    );
  }
  return next;
}

const surfaces = [
  { path: README, contents: readmeWithVoice() },
  { path: CARD, contents: `${renderVoiceCard(pack)}\n` },
  { path: CONTRACTS, contents: contractsWithTone() },
];

const check = process.argv.includes('--check');
const stale = surfaces.filter(({ path, contents }) => readFileSync(at(path), 'utf8') !== contents);

if (check) {
  if (stale.length > 0) {
    console.error(
      `Stale, regenerate with \`node packages/ai-patterns/scripts/sync-voice.mjs\`:\n` +
        stale.map(({ path }) => `  ${path}`).join('\n'),
    );
    process.exit(1);
  }
  process.stdout.write('voice surfaces are in sync\n');
} else {
  for (const { path, contents } of stale) {
    writeFileSync(at(path), contents);
    process.stdout.write(`wrote ${path}\n`);
  }
}
