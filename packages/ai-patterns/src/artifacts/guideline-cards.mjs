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
   card, not mixed into the 50..900 ramp.

   An empty result throws for the same reason `byName` does, and the palette
   split is what made it necessary. `--signal-*` and `--anchor-*` moved out of
   tokens.css into palettes.css; a caller still reading tokens.css alone gets a
   few hundred tokens, no ramp, and — before this guard — a signal card and an
   anchor card containing one empty `<div class="row">` each. Nothing threw,
   the cards were written to disk, and the brand had silently left the
   guidelines. A family this file asks for is an invariant, exactly like a name
   in `byName`, and an absent one is a stale reader or a rename. */
const numericRamp = (tokens, prefix, path) => {
  const steps = tokens.filter((token) => new RegExp(`^${prefix}\\d+$`).test(token.name));
  if (steps.length === 0) {
    throw new Error(
      `buildGuidelineCards: ${path} renders the ${prefix} ramp, of which the ` +
        'supplied tokens define no step. Read every token stylesheet — ' +
        '`readTokenStylesheets()` from @elirobinson/tokens/token-stylesheets — ' +
        'not tokens.css alone.',
    );
  }
  return steps;
};

/* Named tokens, in the order given — for families that are a set, not a ramp.
   The lists are invariants written into this file, so a name with no token is a
   mistake in the generator or a rename in tokens.css, never a runtime condition.
   Skipping it would reproduce the ink bug exactly: a card one swatch short and
   nothing failing. Every missing name is reported at once, because a rename
   usually moves a whole family and fixing them one error at a time is slower. */
const byName = (tokens, names, path) => {
  const found = names.map((name) => tokens.find((token) => token.name === name));
  const missing = names.filter((_, index) => !found[index]);
  if (missing.length > 0) {
    throw new Error(
      `buildGuidelineCards: ${path} names ${missing.join(', ')}, ` +
        'which the supplied token stylesheets do not define.',
    );
  }
  return found;
};

/** `--ink-500` -> `500`, `--radius-sm` -> `sm`, `--shadow-xs` -> `xs`. */
const step = (token, prefix) => token.name.slice(prefix.length);

/* The four states, and the five tokens every one of them declares. Written out
   rather than discovered by prefix so a state or a member that stops being
   declared fails in `byName` instead of quietly rendering a shorter card —
   `--status-*-on` and `--status-*-tint-edge` are new, and a card that shows a
   fill without them is what leaves someone guessing at the ink. */
const STATUS_STATES = ['success', 'warning', 'danger', 'info'];
const STATUS_MEMBERS = ['', '-on', '-fg', '-tint', '-tint-edge'];

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

  const ramp = (prefix, path, { bordered = false } = {}) =>
    numericRamp(tokens, prefix, path).map((token) =>
      swatch(token, step(token, prefix), { bordered }),
    );

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
      body: row(ramp('--ink-', 'colors-ink.html', { bordered: true })),
    }),
  });

  cards.push({
    path: 'colors-signal.html',
    html: card({
      group: 'Colors',
      viewport: '700x140',
      name: 'Signal / Amber',
      subtitle: 'Miltinson Amber — the only loud colour, used as a signal not a fill',
      body: row(ramp('--signal-', 'colors-signal.html')),
    }),
  });

  cards.push({
    path: 'colors-anchor.html',
    html: card({
      group: 'Colors',
      viewport: '700x140',
      name: 'Anchor / Forest',
      subtitle: 'Miltinson Forest — secondary anchor for trust marks and success',
      body: row(ramp('--anchor-', 'colors-anchor.html')),
    }),
  });

  /* -- Semantic sets ----------------------------------------------------- */
  const named = (path, names, options) =>
    byName(tokens, names, path).map((token) =>
      swatch(token, token.name.replace(/^--/, ''), options),
    );

  /* A status is five tokens, not one. The card that showed only `--status-*`
     was the ink bug in a different family: a designer reading it saw four
     fills and had no way to know that the ink to put on one, the tint behind
     it and the tint's edge were all decided too — so they picked their own,
     and a badge went out with 2.4:1 text on a tint nobody had measured.
     Every member of a state is on the card, on one row, so the set is legible
     as a set. */
  const statusRow = (state) => {
    const names = STATUS_MEMBERS.map((suffix) => `--status-${state}${suffix}`);
    /* Warning is the one asymmetric state. Deep amber on a pale amber tint
       has no edge a border can borrow from the fill, so it declares its own —
       and an outline nobody can see is exactly what the card must not hide. */
    if (state === 'warning') names.push('--status-warning-border');
    return (
      '<div style="display:grid;gap:6px">' +
      `<span class="lbl">${state}</span>` +
      row(
        byName(tokens, names, 'colors-status.html').map((token) =>
          // Bordered throughout: the tints and every `-on` are near-white.
          swatch(token, token.name.slice(`--status-${state}`.length).replace(/^-/, '') || 'fill', {
            bordered: true,
          }),
        ),
      ) +
      '</div>'
    );
  };

  cards.push({
    path: 'colors-status.html',
    html: card({
      group: 'Colors',
      viewport: '700x420',
      name: 'Status',
      subtitle: 'Status colours — fill, the ink that goes on it, the tint behind it and its edge',
      body:
        '<div style="display:grid;gap:18px">' +
        STATUS_STATES.map((state) => statusRow(state)).join('') +
        '</div>',
    }),
  });

  /* Categorical, not a ramp: `--chart-1` is not lighter or darker than
     `--chart-8`, it is a different series, and the numbering is the assignment
     order a chart library walks. Rendering it as a ramp would invite someone to
     read the low numbers as "subtle" and reach past them. */
  cards.push({
    path: 'colors-data.html',
    html: card({
      group: 'Colors',
      viewport: '700x260',
      name: 'Data & charts',
      subtitle: 'Eight categorical series in assignment order, plus the grid and axis rules',
      body:
        '<div style="display:grid;gap:18px">' +
        '<div style="display:grid;gap:6px"><span class="lbl">series</span>' +
        row(ramp('--chart-', 'colors-data.html')) +
        '</div>' +
        '<div style="display:grid;gap:6px"><span class="lbl">chrome</span>' +
        /* Drawn as rules rather than chips. Both resolve to a border token, so
           as a 56x48 fill they are two near-identical pale rectangles and the
           card says nothing about which line is which. */
        '<div class="row" style="gap:24px">' +
        byName(tokens, ['--chart-grid', '--chart-axis'], 'colors-data.html')
          .map(
            (token) =>
              '<div style="display:grid;gap:6px;width:220px">' +
              `<div style="height:48px;border-top:1px solid var(${token.name});` +
              `border-bottom:1px solid var(${token.name})"></div>` +
              `<span class="lbl">${token.name.replace(/^--/, '')}</span></div>`,
          )
          .join('') +
        '</div></div></div>',
    }),
  });

  /* -- The palette dial --------------------------------------------------
     One scale, rendered once per palette per theme — every palette against
     every theme.

     This needs no rendering engine and gets none. The blocks in palettes.css
     are bare `[data-palette]` / `[data-theme]` selectors, not `:root`-anchored
     ones, so an element carrying those attributes re-declares the brand tokens
     over its own subtree and the identical markup below resolves differently
     inside each panel. The markup is generated once and repeated verbatim;
     that it is byte-identical in every panel is the point, because a
     component's markup is byte-identical across palettes too.

     PALETTE_PANELS is hand-maintained and has to grow when palettes.css does.
     It cannot be derived from tokens' own PALETTES list without ai-patterns
     taking a dependency on @elirobinson/tokens, which it deliberately does
     not have.

     Scoped to the brand tokens on purpose. `--ink-*` are declared once on
     `:root` with `var(--n-mult)` and `var(--n-h)` substituted *there*, and a
     descendant that re-points those two dials cannot re-mix greys computed
     above it — so a neutral swatch in the slate panel would show ember's grey
     under a slate label. The panel background is the only neutral here, and it
     sits at the ends of the ramp where the two palettes are indistinguishable.
     Neutrals belong on the ink card, which is honest about being one set. */
  const PALETTE_PANELS = [
    { label: 'ember · light', attrs: '' },
    { label: 'ember · dark', attrs: ' data-theme="dark"' },
    { label: 'slate · light', attrs: ' data-palette="slate"' },
    { label: 'slate · dark', attrs: ' data-palette="slate" data-theme="dark"' },
    { label: 'miltinson · light', attrs: ' data-palette="miltinson"' },
    {
      label: 'miltinson · dark',
      attrs: ' data-palette="miltinson" data-theme="dark"',
    },
  ];

  const paletteScale =
    row(ramp('--signal-', 'colors-palettes.html')) +
    row(
      named(
        'colors-palettes.html',
        [
          '--accent',
          '--accent-ink',
          '--accent-tint',
          '--anchor',
          '--anchor-ink',
          '--anchor-tint',
          '--focus-ring',
        ],
        { bordered: true },
      ),
    );

  cards.push({
    path: 'colors-palettes.html',
    html: card({
      group: 'Colors',
      viewport: '700x1240',
      name: 'Palettes',
      subtitle: 'The same signal ramp and brand semantics under each palette and theme',
      body:
        '<div style="display:grid;gap:16px">' +
        PALETTE_PANELS.map(
          ({ label, attrs }) =>
            `<section${attrs} style="background:var(--bg);color:var(--fg);padding:14px 16px;` +
            'border:1px solid var(--border);border-radius:var(--radius-md);display:grid;gap:10px">' +
            `<span class="lbl">${label}</span>${paletteScale}</section>`,
        ).join('') +
        '</div>',
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
          'colors-surfaces.html',
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
        byName(tokens, ['--fg', '--fg-2', '--fg-3', '--fg-4', '--link-hover'], 'colors-text.html')
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
