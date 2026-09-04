/* The house system prompt, read from contracts.json — never written down twice.
 *
 * This is the CLAUDE.md rule applied to prompts. A consumer who pastes our voice into
 * their own route handler owns a copy that is wrong the next time `systemPromptStyle`
 * moves, and nothing tells them: a prompt has no type error and no failing test. So the
 * prose ships as a function, the same way the token table ships as a stylesheet and the
 * component list ships as `ds`.
 *
 * `contracts.json` is the single source. `renderSystemPrompt` is pure so the derivation
 * can be proved — feed it a fabricated style and the output must change — and
 * `houseSystemPrompt` is the one that reads the file. Nothing here may contain a value
 * from `systemPromptStyle` as a literal; `prompt.test.mjs` reads this file back and
 * fails if one appears.
 *
 * The connective words below ("Write in this voice", "Never", "Always") are scaffolding,
 * not contract values. They are the only prose this module owns.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** The contract file this package publishes at `@elirobinson/ai-patterns/contracts`. */
export const CONTRACTS_PATH = join(here, '..', 'contracts.json');

/* Every field of `systemPromptStyle` this renderer reads, stated once rather than implied
   by an optional chain at each use site. A style missing one of them is a stale or edited
   contracts.json, and the honest response is to say which field is gone — not to render a
   prompt with a silent hole in it, which is indistinguishable from a good one until a
   model's output drifts. `verifiedBy` is deliberately not read: it names what enforces a
   constraint for a human reader, and is not an instruction to a model. */
const REQUIRED_STYLE_FIELDS = ['voice', 'forbidden', 'required'];

function assertStyleShape(style) {
  if (style === null || typeof style !== 'object') {
    throw new TypeError('systemPromptStyle is not an object — contracts.json is malformed.');
  }

  const missing = REQUIRED_STYLE_FIELDS.filter((field) => style[field] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `systemPromptStyle is missing ${missing.join(', ')} — the house system prompt cannot ` +
        'be rendered from it. Either restore the field in contracts.json or teach ' +
        'renderSystemPrompt to do without it.',
    );
  }

  for (const field of ['forbidden', 'required']) {
    if (!Array.isArray(style[field]) || style[field].length === 0) {
      throw new Error(`systemPromptStyle.${field} must be a non-empty array of strings.`);
    }
  }

  if (typeof style.voice !== 'string' || style.voice.trim() === '') {
    throw new Error('systemPromptStyle.voice must be a non-empty string.');
  }

  return style;
}

/** `systemPromptStyle`, as `contracts.json` currently declares it. */
export function readSystemPromptStyle({ path = CONTRACTS_PATH } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new Error(`${path} could not be read as JSON: ${cause.message}`, { cause });
  }

  return assertStyleShape(parsed.systemPromptStyle);
}

/**
 * A style object → the prompt text. Pure: no filesystem, no resolution.
 *
 * `append` is where a consumer's own instructions go. It goes last on purpose — a model
 * weights the end of a system prompt more heavily, and the product's task is more
 * specific than our voice. The voice still cannot be deleted, only added to, which is the
 * whole point of the wrapper.
 */
export function renderSystemPrompt(style, { append } = {}) {
  assertStyleShape(style);

  const lines = [
    `Write in this voice: ${style.voice}.`,
    '',
    `Never: ${style.forbidden.join(', ')}.`,
    '',
    `Always: ${style.required.join(', ')}.`,
  ];

  if (typeof append === 'string' && append.trim() !== '') {
    lines.push('', append.trim());
  }

  return lines.join('\n');
}

/** The house system prompt. Reads `contracts.json`, so it cannot go stale. */
export function houseSystemPrompt(options = {}) {
  const { path, ...rest } = options;
  return renderSystemPrompt(readSystemPromptStyle({ path }), rest);
}
