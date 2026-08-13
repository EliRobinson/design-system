/* The foundation cards that are pure enumerations of the token scale.
 *
 * Why generated: a swatch card is a restatement of tokens.css in markup, and a
 * hand-authored one drifts silently. The copy this replaces rendered 10 of the
 * 13 ink steps — `--ink-700`, `--ink-900` and `--ink-950` had been added to
 * tokens.css and never reached the card, so the palette a designer read was
 * missing three values and nothing anywhere failed.
 *
 * Only the enumerations live here. Cards that carry editorial judgement —
 * brand voice, the wordmark rules, type specimens, "spacing in use" — are
 * writing, not data, and are mirrored from the design project instead.
 *
 * Each card opens with the `@dsCard` marker the Design System pane reads to
 * build its index, so a generated card is indistinguishable from a hand-made
 * one at the far end.
 */

/** Families are matched by prefix so a new step in tokens.css lands automatically. */
const byPrefix = (tokens, prefix) => tokens.filter((token) => token.name.startsWith(prefix));

/* A colour ramp is only the numbered steps. Prefix alone is not enough: the
   anchor family also declares `--anchor-hover`, `--anchor-press`, `--anchor-fg`
   and `--anchor-tint`, which are semantic aliases and belong on the surfaces
   card, not mixed into the 50..900 ramp. */
const numericRamp = (tokens, prefix) =>
  tokens.filter((token) => new RegExp(`^${prefix}\\d+$`).test(token.name));

/** Named tokens, in the order given — for families that are a set, not a ramp. */
const byName = (tokens, names) =>
  names.map((name) => tokens.find((token) => token.name === name)).filter(Boolean);

/** `--ink-500` -> `500`, `--radius-sm` -> `sm`, `--shadow-xs` -> `xs`. */
const step = (token, prefix) => token.name.slice(prefix.length);

const PREAMBLE =
  'body{margin:0;padding:20px;background:var(--bg);font-family:var(--font-sans)}' +
  '.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}' +
  '.lbl{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;' +
  'text-transform:uppercase;color:var(--fg-3)}';

/** The shell every card shares, including the pane's index marker. */
function card({ group, viewport, name, subtitle, body }) {
  const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return (
    `<!-- @dsCard group="${escape(group)}" viewport="${viewport}" name="${escape(name)}" ` +
    `subtitle="${escape(subtitle)}" -->\n` +
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="../styles.css">' +
    `<style>${PREAMBLE}</style></head><body>${body}</body></html>\n`
  );
}

/** A labelled swatch. `bordered` keeps near-white chips visible on white. */
const swatch = (token, label, { bordered = false } = {}) =>
  '<div style="display:grid;gap:6px">' +
  `<div style="width:56px;height:48px;border-radius:var(--radius-sm);background:var(${token.name})` +
  `${bordered ? ';border:1px solid var(--border)' : ''}"></div>` +
  `<span class="lbl">${label}</span></div>`;

const row = (contents) => `<div class="row">${contents.join('')}</div>`;

/**
 * Every generated foundation card, keyed by the path it is written to.
 *
 * @param {Array<{name: string, value: string, resolved: string, comment: string | null}>} tokens
 * @returns {Array<{path: string, html: string}>}
 */
export function buildGuidelineCards(tokens) {
  if (!tokens?.length) throw new Error('buildGuidelineCards: no tokens supplied.');

  const ramp = (prefix, { bordered = false } = {}) =>
    numericRamp(tokens, prefix).map((token) => swatch(token, step(token, prefix), { bordered }));

  const cards = [];

  /* -- Colour ramps ------------------------------------------------------ */
  cards.push({
    path: 'colors-ink.html',
    html: card({
      group: 'Colors',
      viewport: '700x140',
      name: 'Ink scale',
      subtitle: 'Ink scale — pure black and white pinned, mids in oklch',
      // Bordered: ink-0 and ink-50 are invisible against a white card.
      body: row(ramp('--ink-', { bordered: true })),
    }),
  });

  cards.push({
    path: 'colors-signal.html',
    html: card({
      group: 'Colors',
      viewport: '700x140',
      name: 'Signal / Amber',
      subtitle: 'Miltinson Amber — the only loud colour, used as a signal not a fill',
      body: row(ramp('--signal-')),
    }),
  });

  cards.push({
    path: 'colors-anchor.html',
    html: card({
      group: 'Colors',
      viewport: '700x140',
      name: 'Anchor / Forest',
      subtitle: 'Miltinson Forest — secondary anchor for trust marks and success',
      body: row(ramp('--anchor-')),
    }),
  });

  /* -- Semantic sets ----------------------------------------------------- */
  const named = (names, options) =>
    byName(tokens, names).map((token) => swatch(token, token.name.replace(/^--/, ''), options));

  cards.push({
    path: 'colors-status.html',
    html: card({
      group: 'Colors',
      viewport: '700x140',
      name: 'Status',
      subtitle: 'Status colours — success maps to Forest, warning to deep Amber',
      body: row(
        named(['--status-success', '--status-warning', '--status-danger', '--status-info']),
      ),
    }),
  });

  cards.push({
    path: 'colors-surfaces.html',
    html: card({
      group: 'Colors',
      viewport: '700x150',
      name: 'Semantic surfaces',
      subtitle: 'Semantic surfaces and borders — what components actually reference',
      body: row(
        named(
          [
            '--bg',
            '--bg-subtle',
            '--bg-muted',
            '--surface',
            '--surface-2',
            '--surface-3',
            '--border',
            '--border-strong',
          ],
          { bordered: true },
        ),
      ),
    }),
  });

  cards.push({
    path: 'colors-text.html',
    html: card({
      group: 'Colors',
      viewport: '700x150',
      name: 'Text colours',
      subtitle: 'Text ramp: fg, fg-2, fg-3, fg-4 and the amber link hover',
      body:
        '<div style="display:grid;gap:8px;font-size:16px">' +
        byName(tokens, ['--fg', '--fg-2', '--fg-3', '--fg-4', '--link-hover'])
          .map(
            (token) =>
              `<span style="color:var(${token.name})">${token.name.replace(/^--/, '')} — ` +
              'The quick brown fox jumps over the lazy dog</span>',
          )
          .join('') +
        '</div>',
    }),
  });

  /* -- Radii ------------------------------------------------------------- */
  cards.push({
    path: 'radii.html',
    html: card({
      group: 'Foundations',
      viewport: '700x150',
      name: 'Radii',
      subtitle: 'Sharp by default — 4px buttons, 6px cards, pill for tags only',
      body: row(
        byPrefix(tokens, '--radius-').map(
          (token) =>
            '<div style="display:grid;gap:6px">' +
            '<div style="width:88px;height:56px;background:var(--bg-subtle);' +
            `border:1px solid var(--border-strong);border-radius:var(${token.name})"></div>` +
            `<span class="lbl">${step(token, '--radius-')} ${token.resolved}</span></div>`,
        ),
      ),
    }),
  });

  /* -- Shadows. `--shadow-focus` is a ring, not an elevation; it belongs on
        the focus card and would read as a mistake in an elevation ramp. ---- */
  cards.push({
    path: 'shadows.html',
    html: card({
      group: 'Foundations',
      viewport: '700x160',
      name: 'Shadows',
      subtitle: 'Restrained — borders do the work; lg and up for overlays only',
      body: row(
        byPrefix(tokens, '--shadow-')
          .filter((token) => token.name !== '--shadow-focus')
          .map(
            (token) =>
              '<div style="display:grid;gap:8px">' +
              '<div style="width:100px;height:60px;background:var(--surface);' +
              `border-radius:var(--radius-md);box-shadow:var(${token.name})"></div>` +
              `<span class="lbl">${step(token, '--shadow-')}</span></div>`,
          ),
      ),
    }),
  });

  /* -- Spacing ----------------------------------------------------------- */
  cards.push({
    path: 'spacing-scale.html',
    html: card({
      group: 'Spacing',
      viewport: '700x170',
      name: 'Spacing scale',
      subtitle: '4px base — space-1 (4) through space-15 (192)',
      body:
        '<div style="display:grid;gap:6px">' +
        byPrefix(tokens, '--space-')
          .filter((token) => token.resolved !== '0')
          .map(
            (token) =>
              '<div style="display:flex;align-items:center;gap:10px">' +
              `<span class="lbl" style="width:72px">${step(token, '--space-')}</span>` +
              `<div style="height:12px;width:var(${token.name});background:var(--accent)"></div>` +
              `<span class="lbl">${token.resolved}</span></div>`,
          )
          .join('') +
        '</div>',
    }),
  });

  /* -- Type weights ------------------------------------------------------ */
  cards.push({
    path: 'type-weights.html',
    html: card({
      group: 'Type',
      viewport: '700x140',
      name: 'Weights',
      subtitle: '300/400/500/600/700/800 — 400 body, 500 UI, 600 headings',
      body:
        '<div class="row" style="gap:20px">' +
        byPrefix(tokens, '--fw-')
          .map(
            (token) =>
              '<div style="display:grid;gap:4px">' +
              `<span style="font-weight:var(${token.name});font-size:24px;color:var(--fg)">Aa</span>` +
              `<span class="lbl">${step(token, '--fw-')} ${token.resolved}</span></div>`,
          )
          .join('') +
        '</div>',
    }),
  });

  /* -- Motion ------------------------------------------------------------ */
  cards.push({
    path: 'motion.html',
    html: card({
      group: 'Foundations',
      viewport: '700x150',
      name: 'Motion',
      subtitle: 'Calm and purposeful — 140ms hovers, 220ms state changes',
      body:
        '<div style="display:grid;gap:10px;font-size:14px;color:var(--fg-2)"><span>' +
        byPrefix(tokens, '--dur-')
          .map(
            (token) => `<b style="color:var(--fg)">${step(token, '--dur-')}</b> ${token.resolved}`,
          )
          .join(' · ') +
        '</span>' +
        byPrefix(tokens, '--ease-')
          .map(
            (token) =>
              `<span><b style="color:var(--fg)">${step(token, '--ease-')}</b> ${token.resolved}</span>`,
          )
          .join('') +
        '<span>No parallax, no bouncy page transitions.</span></div>',
    }),
  });

  return cards;
}
