/* tokens.json, tokens.css and the token rules tokens.json cannot hold, for the
 * Claude "Design System" artifact.
 *
 * Values come from packages/tokens/src. Prose comes from the artifact: the
 * usage note on each token and the type style notes are written on the
 * artifact's page, so they are read back from the previous tokens.json and
 * kept. A token the previous file does not have gets an empty note and is
 * listed in the report.
 *
 * The artifact holds 8 colour themes at most. The repo has 5 palettes, each
 * light and dark. Slate is left out.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postcss from 'postcss';

/** Theme ids in artifact order. The first is the default. */
export const THEMES = [
  'light',
  'dark',
  'palette-miltinson',
  'palette-miltinson-dark',
  'palette-miltinson-tech',
  'palette-miltinson-tech-dark',
  'palette-steady',
  'palette-steady-dark',
];
export const THEMES_LEFT_OUT = ['palette-slate', 'palette-slate-dark'];

export const FONTS = [
  { family: 'Geist', file: 'geist-latin-wght-normal.woff2', weight: '100 900', style: 'normal' },
  {
    family: 'JetBrains Mono',
    file: 'jetbrains-mono-latin-wght-normal.woff2',
    weight: '100 800',
    style: 'normal',
  },
];

/* The type styles the artifact shows, by group. Values are read from the
   `body` rule and the `.t-*` classes in tokens.css. t-display-1, t-display-2
   and t-code are left out on purpose: the artifact's Typography view caps the
   groups, and those three are covered by --fs-* and t-mono. */
const TYPE_GROUPS = [
  { name: 'Type styles', styles: ['body'] },
  { name: 'Headings', styles: ['t-h1', 't-h2', 't-h3', 't-h4', 't-h5'] },
  { name: 'Text', styles: ['t-lead', 't-body', 't-body-sm', 't-caption', 't-eyebrow', 't-mono'] },
];

/* Non-colour families, used for a token the previous tokens.json does not
   place. First match wins. */
const FAMILY_RULES = [
  ['spacing', /^(container-|target|tr-|space-|anchored-)/],
  ['radius', /^radius-/],
  ['shadow', /^shadow-/],
  ['motion', /^(ease-|dur-)/],
  ['other', /^(n-h|n-mult|z-)/],
  ['fontSize', /^(fs-|mark-size)/],
  ['lineHeight', /^lh-/],
  ['fontWeight', /^fw-/],
];
const FAMILY_ORDER = FAMILY_RULES.map(([family]) => family);
const COLOUR_NAME =
  /^(signal|anchor|accent|focus|link|status|chart|ink|bg|surface|border|fg|scrim)/;
/* These live in bundle.css: tokens.json has no grammar for them. */
const NOT_IN_JSON = ['link-on-fill', 'gutter', 'safe-t', 'safe-r', 'safe-b', 'safe-l'];
const FONT_VARS = ['font-sans', 'font-display', 'font-mono'];

const COLOUR_RE = /^(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch|color)\([-\d.% /a-z,]*\))$/;
const NUMERIC_ARGS = /^[a-z]+\(([-\d.%/ ,]|none)*\)$/;

function norm(value) {
  return value.trim().replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
}

/** Top-level rules that declare custom properties, keyed by normalised selector. */
function customPropertyBlocks(css) {
  const blocks = new Map();
  for (const node of postcss.parse(css).nodes) {
    if (node.type !== 'rule') continue;
    const decls = new Map();
    for (const decl of node.nodes) {
      if (decl.type === 'decl' && decl.prop.startsWith('--'))
        decls.set(decl.prop, norm(decl.value));
    }
    if (decls.size) blocks.set(node.selector.replace(/\s+/g, ' ').trim(), decls);
  }
  return blocks;
}

function need(blocks, selector, file) {
  const block = blocks.get(selector);
  if (!block) throw new Error(`${file}: no top-level block for ${selector}`);
  return block;
}

/**
 * Every custom property per theme, with the cascade the browser applies.
 * The --ink-* steps are mixed from the --n-h and --n-mult dials, which each
 * palette sets, so they are resolved per theme here.
 */
export function resolveThemes(srcDir) {
  const palettes = customPropertyBlocks(readFileSync(join(srcDir, 'palettes.css'), 'utf8'));
  const tokens = customPropertyBlocks(readFileSync(join(srcDir, 'tokens.css'), 'utf8'));
  const dark = "[data-theme='dark'], .dark";
  const paletteRoot = need(palettes, ':root', 'palettes.css');
  const paletteDark = need(palettes, dark, 'palettes.css');
  const tokensRoot = need(tokens, ':root', 'tokens.css');
  const tokensDark = need(tokens, dark, 'tokens.css');

  const shared = [...paletteRoot.keys()].filter(
    (name) => tokensRoot.has(name) || tokensDark.has(name),
  );
  if (shared.length)
    throw new Error(`palettes.css and tokens.css both declare ${shared.join(', ')}`);

  const paletteBlock = (name, isDark) =>
    need(
      palettes,
      isDark
        ? `[data-palette='${name}'][data-theme='dark'], [data-palette='${name}'].dark`
        : `[data-palette='${name}']`,
      'palettes.css',
    );

  /* Later wins. Specificity is folded into the order: every block is (0,1,0)
     except the palette's dark block, which is (0,2,0) and so beats them all. */
  function cascade(theme) {
    const isDark = theme.endsWith('dark');
    const palette = theme.startsWith('palette-')
      ? theme.slice('palette-'.length).replace(/-dark$/, '')
      : null;
    const seq = [paletteRoot];
    if (isDark) seq.push(paletteDark);
    if (palette) seq.push(paletteBlock(palette, false));
    seq.push(tokensRoot);
    if (isDark) seq.push(tokensDark);
    if (palette && isDark) seq.push(paletteBlock(palette, true));
    return seq;
  }

  const order = [];
  const add = (block) => {
    for (const name of block.keys()) if (!order.includes(name)) order.push(name);
  };
  add(paletteRoot);
  add(tokensRoot);
  for (const block of palettes.values()) add(block);
  add(tokensDark);

  const resolved = {};
  for (const theme of THEMES) {
    const raw = new Map();
    for (const block of cascade(theme)) for (const [name, value] of block) raw.set(name, value);
    const out = new Map();
    for (const [name, value] of raw) out.set(name, substituteNeutral(value, raw));
    resolved[theme] = out;
  }
  return { resolved, order: order.map((name) => name.slice(2)), paletteRoot, tokensRoot };
}

function substituteNeutral(value, raw) {
  if (!value.includes('var(--n-')) return value;
  return value
    .replaceAll('var(--n-h)', raw.get('--n-h'))
    .replaceAll('var(--n-mult)', raw.get('--n-mult'))
    .replace(/calc\(([\d.]+) \* ([\d.]+)\)/g, (_, a, b) =>
      (Number(a) * Number(b)).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''),
    );
}

function isLiteralColour(value) {
  return COLOUR_RE.test(value) && (value.startsWith('#') || NUMERIC_ARGS.test(value));
}

function aliasOf(value) {
  return /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1] ?? null;
}

/** A per-theme value collapses to one string when every theme agrees. */
function collapse(values) {
  return new Set(Object.values(values)).size === 1 ? values[THEMES[0]] : values;
}

function valueIn(token, theme) {
  return typeof token.value === 'string' ? token.value : token.value[theme];
}

/** Name -> {family, usage, order} from the previous tokens.json, if any. */
function previousIndex(previous) {
  const index = new Map();
  if (!previous) return index;
  for (const [family, entry] of Object.entries(previous)) {
    if (family === 'type' || !entry || !Array.isArray(entry.tokens)) continue;
    entry.tokens.forEach((token, position) =>
      index.set(token.name, { family, usage: token.usage ?? '', position, value: token.value }),
    );
  }
  return index;
}

/**
 * @param {object} options
 * @param {string} options.srcDir   packages/tokens/src
 * @param {object} [options.previous] the live artifact's tokens.json, for prose and order
 * @param {object} options.meta     the provenance note: {ref, synced}
 */
export function buildTokens({ srcDir, previous, meta }) {
  const { resolved: R, order, paletteRoot, tokensRoot } = resolveThemes(srcDir);
  const prev = previousIndex(previous);
  const report = { newTokens: [], notPlaced: [], keptFromPrevious: [] };
  const usage = (name) => {
    if (prev.has(name)) return prev.get(name).usage;
    report.newTokens.push(name);
    return '';
  };

  /* ---- colour */
  const colourValue = (name, theme) => {
    let value = R[theme].get(`--${name}`);
    if (value === undefined) return null;
    if (value.startsWith('#')) value = value.toLowerCase();
    if (isLiteralColour(value)) return value;
    const alias = aliasOf(value);
    return alias === null ? null : `{${alias}}`;
  };
  const colour = [];
  for (const name of order) {
    const previousFamily = prev.get(name)?.family;
    if (previousFamily && previousFamily !== 'color') continue;
    if (NOT_IN_JSON.includes(name) || FONT_VARS.includes(name)) continue;
    if (THEMES.some((theme) => !R[theme].has(`--${name}`))) continue;
    if (!previousFamily && !COLOUR_NAME.test(name)) continue;
    if (THEMES.some((theme) => colourValue(name, theme) === null)) {
      report.notPlaced.push(name);
      continue;
    }
    colour.push(name);
  }
  for (const name of colour) {
    for (const theme of THEMES) {
      const value = colourValue(name, theme);
      if (value.startsWith('{') && !colour.includes(value.slice(1, -1))) {
        throw new Error(`--${name} aliases ${value}, which is not a colour token`);
      }
    }
  }
  const colourTokens = colour.map((name) => ({
    name,
    value: collapse(Object.fromEntries(THEMES.map((theme) => [theme, colourValue(name, theme)]))),
    usage: usage(name),
  }));

  /* ---- other families. Shadows reference colours, so resolve them per theme. */
  const literal = (name, theme) => {
    let value = colourValue(name, theme);
    for (let depth = 0; value?.startsWith('{'); depth++) {
      if (depth > 16) throw new Error(`alias chain too deep at --${name}`);
      value = colourValue(value.slice(1, -1), theme);
    }
    if (value === null) throw new Error(`--${name} has no colour value in ${theme}`);
    return value;
  };
  const familyValue = (name, family) => {
    if (family === 'shadow') {
      return collapse(
        Object.fromEntries(
          THEMES.map((theme) => [
            theme,
            R[theme]
              .get(`--${name}`)
              .replace(/var\(--([a-z0-9-]+)\)/g, (_, ref) => literal(ref, theme)),
          ]),
        ),
      );
    }
    /* The neutral dials differ per palette, but the inks are already resolved
       per theme, so the dial rows show ember's value. */
    if (name === 'n-h' || name === 'n-mult') return paletteRoot.get(`--${name}`);
    const value = R[THEMES[0]].get(`--${name}`);
    for (const theme of THEMES) {
      if (R[theme].get(`--${name}`) !== value) {
        throw new Error(`--${name} differs by theme but is not a colour or a shadow`);
      }
    }
    return value;
  };

  const placed = new Set(colour);
  const families = new Map();
  const familyOf = (name) => FAMILY_RULES.find(([, pattern]) => pattern.test(name))?.[0];
  const previousFamilies = previous
    ? Object.keys(previous).filter(
        (key) => key !== 'color' && key !== 'type' && Array.isArray(previous[key]?.tokens),
      )
    : [];
  for (const family of [...previousFamilies, ...FAMILY_ORDER]) {
    if (!families.has(family)) families.set(family, []);
  }
  /* Previous members first, in their order, so a re-sync does not reshuffle the page. */
  for (const family of previousFamilies) {
    for (const token of previous[family].tokens) {
      placed.add(token.name);
      if (!R[THEMES[0]].has(`--${token.name}`)) {
        report.keptFromPrevious.push(token.name);
        families
          .get(family)
          .push({ name: token.name, value: token.value, usage: token.usage ?? '' });
        continue;
      }
      families.get(family).push({
        name: token.name,
        value: familyValue(token.name, family),
        usage: token.usage ?? '',
      });
    }
  }
  for (const name of order) {
    if (placed.has(name) || NOT_IN_JSON.includes(name) || FONT_VARS.includes(name)) continue;
    const family = familyOf(name);
    if (!family) {
      report.notPlaced.push(name);
      continue;
    }
    families.get(family).push({ name, value: familyValue(name, family), usage: usage(name) });
  }
  for (const [family, members] of families) if (!members.length) families.delete(family);

  /* ---- type */
  const tokensCss = readFileSync(join(srcDir, 'tokens.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const classes = new Map();
  for (const match of tokensCss.matchAll(/\.(t-[a-z0-9-]+)\s*\{([^}]*)\}/g)) {
    classes.set(match[1], declarations(match[2]));
  }
  const bodyRule = [...tokensCss.matchAll(/\nbody\s*\{([^}]*)\}/g)]
    .map((match) => match[1])
    .find((body) => body.includes('font-family'));
  if (!bodyRule) throw new Error('tokens.css: no body rule with a font-family');
  classes.set('body', declarations(bodyRule));

  const lit = (value) =>
    value.replace(/var\(--([a-z0-9-]+)\)/g, (_, name) => R[THEMES[0]].get(`--${name}`));
  const previousStyles = new Map(
    (previous?.type?.groups ?? []).flatMap((group) =>
      group.styles.map((style) => [style.name, style]),
    ),
  );
  const groups = TYPE_GROUPS.map((group) => ({
    name: group.name,
    family: 'sans',
    styles: group.styles.map((name) => {
      const decl = classes.get(name);
      if (!decl) throw new Error(`tokens.css: no .${name} rule`);
      const familyKey = /^var\(--font-([a-z]+)\)$/.exec(decl['font-family'])?.[1];
      if (!familyKey) throw new Error(`.${name}: font-family is not a --font-* token`);
      const style = { name };
      if (familyKey !== 'sans') style.family = familyKey;
      style.fontSize = lit(decl['font-size']);
      style.lineHeight = lit(decl['line-height']);
      if (decl['font-weight']) style.fontWeight = Number(lit(decl['font-weight']));
      if (decl['letter-spacing']) style.letterSpacing = lit(decl['letter-spacing']);
      style.usage =
        name === 'body'
          ? 'From the `body` rule in packages/tokens/src/tokens.css. Its family is --font-sans.'
          : (previousStyles.get(name)?.usage ?? '');
      return style;
    }),
  }));
  const stack = (key) => {
    const value = tokensRoot.get(`--font-${key}`);
    const match = /^var\(--ds-font-[a-z]+-override, (.*)\)$/.exec(value ?? '');
    if (!match) throw new Error(`--font-${key} is not an override fallback: ${value}`);
    return match[1];
  };
  const type = {
    fonts: FONTS,
    families: Object.fromEntries(['sans', 'display', 'mono'].map((key) => [key, stack(key)])),
    groups,
  };

  /* ---- tokens.json */
  const json = {
    version: 1,
    meta: {
      source: 'github',
      repo: 'EliRobinson/design-system',
      ref: meta.ref,
      package: 'packages/tokens',
      paths: {
        tokens: [
          'packages/tokens/src/tokens.css',
          'packages/tokens/src/palettes.css',
          'packages/tokens/src/mobile.css',
        ],
        fonts: ['packages/tokens/src/fonts.css'],
      },
      synced: meta.synced,
      themesLeftOut: THEMES_LEFT_OUT,
    },
    color: {
      themes: THEMES.map((id) => ({
        id,
        name: id.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      })),
      tokens: colourTokens,
    },
    type,
  };
  for (const [family, tokens] of families) {
    json[family] = { ...(previous?.[family] ?? {}), tokens };
  }
  /* Keep the previous file's key order, so the page sections do not move. */
  const ordered = {};
  for (const key of Object.keys(previous ?? {})) if (key in json) ordered[key] = json[key];
  for (const key of Object.keys(json)) if (!(key in ordered)) ordered[key] = json[key];

  return {
    json: ordered,
    css: compileTokensCss({ colourTokens, families, type }),
    extrasCss: notInJsonCss({ srcDir, paletteRoot, tokensRoot, resolved: R }),
    report,
  };
}

function declarations(body) {
  const out = {};
  for (const part of body.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    out[part.slice(0, at).trim()] = part
      .slice(at + 1)
      .trim()
      .replace(/\s+/g, ' ');
  }
  return out;
}

/** tokens.css in the shape the artifact compiles it to. */
function compileTokensCss({ colourTokens, families, type }) {
  const css = (value) => value.replace(/\{([^}]+)\}/g, 'var(--$1)');
  const shadows = families.get('shadow') ?? [];
  const [first, ...rest] = THEMES;
  const lines = ['/* Miltinson Design System — generated from tokens.json */'];
  lines.push(`:root, [data-theme="${first}"] {`);
  for (const token of colourTokens) lines.push(`  --${token.name}: ${css(valueIn(token, first))};`);
  for (const token of shadows) lines.push(`  --${token.name}: ${valueIn(token, first)};`);
  lines.push('}');
  for (const theme of rest) {
    lines.push(`[data-theme="${theme}"] {`);
    for (const token of colourTokens) {
      const value = valueIn(token, theme);
      /* Aliases are re-declared so they resolve against this theme's ramps. */
      if (value !== valueIn(token, first) || value.startsWith('{')) {
        lines.push(`  --${token.name}: ${css(value)};`);
      }
    }
    for (const token of shadows) {
      if (valueIn(token, theme) !== valueIn(token, first)) {
        lines.push(`  --${token.name}: ${valueIn(token, theme)};`);
      }
    }
    lines.push('}');
  }
  lines.push(':root {');
  for (const [family, tokens] of families) {
    if (family === 'shadow') continue;
    for (const token of tokens) lines.push(`  --${token.name}: ${token.value};`);
  }
  for (const [key, value] of Object.entries(type.families))
    lines.push(`  --font-${key}: ${value};`);
  const body = type.groups[0].styles[0];
  lines.push(
    `  --text-body: ${body.fontWeight ?? 400} ${body.fontSize}/${body.lineHeight} var(--font-sans); /* ${body.usage} */`,
  );
  lines.push('}');
  for (const group of type.groups) {
    for (const style of group.styles) {
      lines.push(`.${style.name} {`);
      lines.push(`  font-family: var(--font-${style.family ?? group.family});`);
      lines.push(`  font-size: ${style.fontSize};`);
      lines.push(`  line-height: ${style.lineHeight};`);
      lines.push(`  font-weight: ${style.fontWeight ?? 400};`);
      if (style.letterSpacing) lines.push(`  letter-spacing: ${style.letterSpacing};`);
      else if (style.name === 'body') lines.push('  letter-spacing: 0;');
      lines.push('}');
    }
  }
  for (const font of type.fonts) {
    lines.push(
      '@font-face {',
      `  font-family: '${font.family}';`,
      `  src: url('fonts/${font.file}') format('woff2');`,
      `  font-weight: ${font.weight};`,
      `  font-style: ${font.style};`,
      '  font-display: swap;',
      '}',
    );
  }
  return `${lines.join('\n')}\n`;
}

/** The token values tokens.json has no grammar for, plus mobile.css verbatim. */
function notInJsonCss({ srcDir, paletteRoot, tokensRoot, resolved }) {
  const linkOnFill = new Set(THEMES.map((theme) => resolved[theme].get('--link-on-fill')));
  if (linkOnFill.size !== 1)
    throw new Error('--link-on-fill differs by theme; it needs a theme block');
  const lines = [
    '/* tokens.css :root and palettes.css (every palette block, light and dark, declares --link-on-fill: currentColor) */',
    ':root {',
    `  --link-on-fill: ${paletteRoot.get('--link-on-fill')};`,
  ];
  for (const name of ['gutter', 'safe-t', 'safe-r', 'safe-b', 'safe-l', ...FONT_VARS]) {
    lines.push(`  --${name}: ${tokensRoot.get(`--${name}`)};`);
  }
  lines.push('}', '');
  lines.push(
    '/* mobile.css, verbatim: the platform layer, keyed on data-platform and a media query, not on a theme */',
  );
  lines.push(readFileSync(join(srcDir, 'mobile.css'), 'utf8').trimEnd());
  return `${lines.join('\n')}\n`;
}
