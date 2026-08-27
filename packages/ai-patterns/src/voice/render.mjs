/* Pack → the forms each surface needs.
 *
 * Pure: no filesystem, no resolution. Callers hand in a validated pack.
 *
 * renderVoice's output is asserted byte-identical to the CONTENT FUNDAMENTALS section
 * that shipped before the pack existed, which is what makes the move a re-hosting
 * rather than a rewrite.
 */

import { validatePack } from './schema.mjs';

const list = (items) => items.join(', ');

/** The markdown body of `## CONTENT FUNDAMENTALS`. No leading or trailing blank line. */
export function renderVoice(pack) {
  validatePack(pack);

  return [
    `How ${pack.label} copy is written. Read this before writing for the brand.`,
    '',
    '### Voice',
    '',
    ...pack.person.guidance.split('\n'),
    '',
    '### Tone (in order of weight)',
    '',
    ...pack.tone.map((step, index) => `${index + 1}. **${step.name}** — ${step.gloss}`),
    '',
    '### Casing & punctuation',
    '',
    ...pack.casing.map((rule) => `- ${rule}`),
    '',
    '### Words to use',
    '',
    list(pack.words.use),
    '',
    '### Words to avoid',
    '',
    list(pack.words.avoid),
    '',
    '### Emoji',
    '',
    ...pack.emoji.guidance.split('\n'),
    '',
    '### Sample copy snippets (real, from the site — use as anchors)',
    '',
    ...pack.samples.map((line) => `- _"${line}"_`),
    '',
    '### Generated taglines (write more in this style)',
    '',
    ...pack.taglines.map((line) => `- "${line}"`),
    '',
    '---',
  ].join('\n');
}

/** The full card for guidelines/brand-voice.html, marker included. */
export function renderVoiceCard(pack) {
  validatePack(pack);

  return [
    /* `fullName`, not `label`: the card's subtitle is the one place the brand
       is named in full, and rendering the short mark here would quietly drop
       "Technologies" from a page that has shipped with it. renderVoice keeps
       `label`, which is what the README section says. */
    `<!-- @dsCard group="Brand" viewport="700x320" name="Voice" subtitle="${pack.fullName}, sentence case, em-dashes, no hype words" -->`,
    '<!doctype html><html><head><meta charset="utf-8">',
    '<link rel="stylesheet" href="../styles.css">',
    '<style>body{margin:0;padding:20px;background:var(--bg);font-family:var(--font-sans)}',
    '.lbl{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3)}</style>',
    '</head><body><div style="display:grid;gap:10px;max-width:600px">',
    `<div><p class="lbl" style="margin:0 0 4px">As a person</p><p class="t-body" style="margin:0">${pack.person.anchors.asPerson}</p></div>`,
    `<div><p class="lbl" style="margin:0 0 4px">As a company</p><p class="t-body" style="margin:0">${pack.person.anchors.asCompany}</p></div>`,
    `<p class="t-body-sm" style="margin:0"><b>Use:</b> ${list(pack.words.use)}.</p>`,
    `<p class="t-body-sm" style="margin:0"><b>Avoid:</b> ${list(pack.words.avoid)}.</p>`,
    '</div></body></html>',
  ].join('');
}

/** The tone ranking as one line, for contracts.json. */
export function toneSummary(pack) {
  validatePack(pack);
  return pack.tone.map((step) => step.name.toLowerCase()).join(', ');
}
