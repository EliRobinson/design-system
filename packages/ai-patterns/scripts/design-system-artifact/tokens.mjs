/* tokens.json, tokens.css and the token rules tokens.json cannot hold, for the
 * Claude "Design System" artifact.
 *
 * Values come from packages/tokens/src, through the same palette × theme
 * cascade the contrast checks use (@elirobinson/tokens/contrast). Prose comes
 * from the artifact: the usage note on each token and the type style notes are
 * written on the artifact's page, so they are read back from the previous
 * tokens.json and kept. A token the previous file does not have gets an empty
 * note and is listed in the report.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  COMBINATIONS,
  DEFAULT_PALETTE,
  combinationDeclarations,
  flattenCalc,
  tokenBlocks,
  unreadableSelectors,
} from '@elirobinson/tokens/contrast';
import { effectiveTokens, parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import {
  PLATFORM_STYLESHEETS,
  TOKEN_STYLESHEETS,
  readPlatformStylesheets,
  readTokenStylesheets,
} from '@elirobinson/tokens/token-stylesheets';
import postcss from 'postcss';

/* The artifact holds 8 colour themes at most, and the repo has 5 palettes ×
   light and dark. These palettes are left out. */
export const PALETTES_LEFT_OUT = ['slate'];

/** The artifact's theme id for a palette × theme. The default palette keeps the bare theme name. */
function themeId({ palette, theme }) {
  if (palette === DEFAULT_PALETTE) return theme;
  return `palette-${palette}${theme === 'dark' ? '-dark' : ''}`;
}

const KEPT = COMBINATIONS.filter(({ palette }) => !PALETTES_LEFT_OUT.includes(palette));
/** Theme ids in artifact order. The first is the default. */
export const ARTIFACT_THEMES = KEPT.map(themeId);
export const THEMES_LEFT_OUT = COMBINATIONS.filter(
  (combination) => !KEPT.includes(combination),
).map(themeId);

/* The type styles the artifact shows, by group. Values are read from the
   `body` rule and the `.t-*` classes in tokens.css. t-display-1, t-display-2
   and t-code are left out on purpose: the artifact's Typography view caps the
   groups, and those three are covered by --fs-* and t-mono. */
const TYPE_GROUPS = [
  { name: 'Type styles', styles: ['body'] },
  { name: 'Headings', styles: ['t-h1', 't-h2', 't-h3', 't-h4', 't-h5'] },
  { name: 'Text', styles: ['t-lead', 't-body', 't-body-sm', 't-caption', 't-eyebrow', 't-mono'] },
];

/* Non-colour families, for a token the previous tokens.json does not place.
   First match wins. These are the artifact type's sections, not the published
   tokens.json groups, so they are not shared with tokens-json.mjs. */
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
const COLOUR_NAME =
  /^(signal|anchor|accent|focus|link|status|chart|ink|bg|surface|border|fg|scrim)/;
const FONT_KEYS = ['sans', 'display', 'mono'];
/* tokens.json has no grammar for these values, so bundle.css declares them. */
const LINK_ON_FILL = 'link-on-fill';
const NOT_IN_JSON = [
  LINK_ON_FILL,
  'gutter',
  'safe-t',
  'safe-r',
  'safe-b',
  'safe-l',
  ...FONT_KEYS.map((key) => `font-${key}`),
];

const COLOUR_RE = /^(#[0-9a-fA-F]{3,8}|(rgba?|hsla?|oklch|oklab|lab|lch|color)\([-\d.% /a-z,]*\))$/;
const NUMERIC_ARGS = /^[a-z]+\(([-\d.%/ ,]|none)*\)$/;

/**
 * Every custom property's declared value per artifact theme, in a stable name
 * order. The --ink-* steps are mixed from the --n-h and --n-mult dials, which
 * each palette sets, so those two are substituted per theme; every other
 * reference stays a reference, because the artifact keeps colour aliases.
 */
export function resolveThemes(srcDir) {
  const sources = readTokenStylesheets(srcDir);
  const unreadable = unreadableSelectors(sources);
  if (unreadable.length) throw new Error(`token blocks no theme reads: ${unreadable.join('; ')}`);
  const resolved = {};
  KEPT.forEach((combination, index) => {
    const declared = combinationDeclarations(sources, combination);
    const dial = (value) =>
      flattenCalc(
        value
          .replaceAll('var(--n-h)', declared.get('--n-h'))
          .replaceAll('var(--n-mult)', declared.get('--n-mult')),
      );
    /* The tokens package keeps the source's line breaks inside parens as spaces; the artifact does not. */
    const tidy = (value) => value.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
    resolved[ARTIFACT_THEMES[index]] = new Map(
      [...declared].map(([name, raw]) => {
        const value = tidy(raw);
        return [name, value.includes('var(--n-') ? dial(value) : value];
      }),
    );
  });
  /* `:root` blocks first, then the rest in cascade order. */
  const blocks = tokenBlocks(sources);
  const isRoot = (block) => block.selector.trim() === ':root';
  const order = [];
  for (const block of [...blocks.filter(isRoot), ...blocks.filter((block) => !isRoot(block))]) {
    for (const [name] of block.declarations) if (!order.includes(name)) order.push(name);
  }
  return { resolved, order: order.map((name) => name.slice(2)) };
}

function isLiteralColour(value) {
  return COLOUR_RE.test(value) && (value.startsWith('#') || NUMERIC_ARGS.test(value));
}

/** A per-theme value collapses to one string when every theme agrees. */
function perTheme(read) {
  const values = Object.fromEntries(ARTIFACT_THEMES.map((theme) => [theme, read(theme)]));
  return new Set(Object.values(values)).size === 1 ? values[ARTIFACT_THEMES[0]] : values;
}

function valueIn(token, theme) {
  return typeof token.value === 'string' ? token.value : token.value[theme];
}

/** Name -> {family, usage} from the previous tokens.json. */
function previousIndex(previous) {
  const index = new Map();
  for (const [family, entry] of Object.entries(previous)) {
    if (family === 'type' || !Array.isArray(entry?.tokens)) continue;
    for (const token of entry.tokens) index.set(token.name, { family, usage: token.usage ?? '' });
  }
  return index;
}

/** Colour value of one token in one theme: a literal, an alias `{name}`, or null. */
function colourReader(R) {
  return (name, theme) => {
    let value = R[theme].get(`--${name}`);
    if (value === undefined) return null;
    if (value.startsWith('#')) value = value.toLowerCase();
    if (isLiteralColour(value)) return value;
    const alias = /^var\(--([a-z0-9-]+)\)$/.exec(value)?.[1];
    return alias ? `{${alias}}` : null;
  };
}

function colourTokens({ R, order, prev, usage, report }) {
  const colourValue = colourReader(R);
  const names = order.filter((name) => {
    const previousFamily = prev.get(name)?.family;
    if (previousFamily && previousFamily !== 'color') return false;
    if (NOT_IN_JSON.includes(name)) return false;
    if (ARTIFACT_THEMES.some((theme) => !R[theme].has(`--${name}`))) return false;
    if (!previousFamily && !COLOUR_NAME.test(name)) return false;
    if (ARTIFACT_THEMES.some((theme) => colourValue(name, theme) === null)) {
      report.notPlaced.push(name);
      return false;
    }
    return true;
  });
  for (const name of names) {
    for (const theme of ARTIFACT_THEMES) {
      const value = colourValue(name, theme);
      if (value.startsWith('{') && !names.includes(value.slice(1, -1))) {
        throw new Error(`--${name} aliases ${value}, which is not a colour token`);
      }
    }
  }
  return names.map((name) => ({
    name,
    value: perTheme((theme) => colourValue(name, theme)),
    usage: usage(name),
  }));
}

function familyTokens({ R, order, previous, placed, usage, report }) {
  const colourValue = colourReader(R);
  const literal = (name, theme) => {
    let value = colourValue(name, theme);
    for (let depth = 0; value?.startsWith('{'); depth++) {
      if (depth > 16) throw new Error(`alias chain too deep at --${name}`);
      value = colourValue(value.slice(1, -1), theme);
    }
    if (value === null) throw new Error(`--${name} has no colour value in ${theme}`);
    return value;
  };
  const first = ARTIFACT_THEMES[0];
  const familyValue = (name, family) => {
    /* Shadows reference colours, and tokens.json takes no var(), so resolve them per theme. */
    if (family === 'shadow') {
      return perTheme((theme) =>
        R[theme]
          .get(`--${name}`)
          .replace(/var\(--([a-z0-9-]+)\)/g, (_, ref) => literal(ref, theme)),
      );
    }
    /* The neutral dials differ per palette, but the inks are already resolved
       per theme, so the dial rows show the default palette's value. */
    const value = R[first].get(`--${name}`);
    if (name === 'n-h' || name === 'n-mult') return value;
    for (const theme of ARTIFACT_THEMES) {
      if (R[theme].get(`--${name}`) !== value) {
        throw new Error(`--${name} differs by theme but is not a colour or a shadow`);
      }
    }
    return value;
  };

  const previousFamilies = Object.keys(previous).filter(
    (key) => key !== 'color' && key !== 'type' && Array.isArray(previous[key]?.tokens),
  );
  const families = new Map();
  for (const family of [...previousFamilies, ...FAMILY_RULES.map(([family]) => family)]) {
    if (!families.has(family)) families.set(family, []);
  }
  /* Previous members first, in their order, so a re-sync does not reshuffle the page. */
  for (const family of previousFamilies) {
    for (const token of previous[family].tokens) {
      placed.add(token.name);
      const inRepo = R[first].has(`--${token.name}`);
      if (!inRepo) report.keptFromPrevious.push(token.name);
      families.get(family).push({
        name: token.name,
        value: inRepo ? familyValue(token.name, family) : token.value,
        usage: token.usage ?? '',
      });
    }
  }
  for (const name of order) {
    if (placed.has(name) || NOT_IN_JSON.includes(name)) continue;
    const family = FAMILY_RULES.find(([, pattern]) => pattern.test(name))?.[0];
    if (!family) {
      report.notPlaced.push(name);
      continue;
    }
    families.get(family).push({ name, value: familyValue(name, family), usage: usage(name) });
  }
  for (const [family, members] of families) if (!members.length) families.delete(family);
  return families;
}

/** The top-level `body` rule and every `.t-*` class in tokens.css, as declaration maps. */
function typeRules(tokensCss) {
  const rules = new Map();
  postcss.parse(tokensCss).walkRules((rule) => {
    const selector = rule.selector.trim();
    const name =
      selector === 'body' && rule.parent.type === 'root'
        ? 'body'
        : /^\.(t-[a-z0-9-]+)$/.exec(selector)?.[1];
    if (!name || rules.has(name)) return;
    const decls = {};
    rule.each((node) => {
      if (node.type === 'decl') decls[node.prop] = node.value.replace(/\s+/g, ' ');
    });
    if (name === 'body' && !decls['font-family']) return;
    rules.set(name, decls);
  });
  return rules;
}

function typeStyles({ srcDir, R, previous }) {
  const rules = typeRules(readFileSync(join(srcDir, 'tokens.css'), 'utf8'));
  const lit = (value) =>
    value.replace(/var\(--([a-z0-9-]+)\)/g, (_, name) => R[ARTIFACT_THEMES[0]].get(`--${name}`));
  const previousStyles = new Map(
    (previous.type?.groups ?? []).flatMap((group) =>
      group.styles.map((style) => [style.name, style]),
    ),
  );
  const groups = TYPE_GROUPS.map((group) => ({
    name: group.name,
    family: 'sans',
    styles: group.styles.map((name) => {
      const decl = rules.get(name);
      if (!decl) throw new Error(`tokens.css: no ${name === 'body' ? 'body' : `.${name}`} rule`);
      const familyKey = /^var\(--font-([a-z]+)\)$/.exec(decl['font-family'])?.[1];
      if (!familyKey) throw new Error(`${name}: font-family is not a --font-* token`);
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
  /* The fallback stack behind each --ds-font-*-override hook. */
  const effective = effectiveTokens(parseTokensCss(readTokenStylesheets(srcDir)));
  const families = Object.fromEntries(
    FONT_KEYS.map((key) => [key, effective.get(`--font-${key}`).resolved]),
  );
  return { fonts: latinFonts(srcDir), families, groups };
}

/** The latin subset of each family, from the @font-face rules in fonts.css. */
export function latinFonts(srcDir) {
  const fonts = [];
  postcss
    .parse(readFileSync(join(srcDir, 'fonts.css'), 'utf8'))
    .walkAtRules('font-face', (rule) => {
      const decls = {};
      rule.walkDecls((decl) => {
        decls[decl.prop] = decl.value;
      });
      const file = /url\(['"]?\.\/fonts\/([\w-]+-latin-wght-normal\.woff2)['"]?\)/.exec(
        decls.src,
      )?.[1];
      if (!file) return;
      fonts.push({
        family: decls['font-family'].replace(/^['"]|['"]$/g, ''),
        file,
        weight: decls['font-weight'],
        style: decls['font-style'],
      });
    });
  if (!fonts.length) throw new Error('fonts.css has no latin @font-face');
  return fonts;
}

/**
 * @param {object} options
 * @param {string} options.srcDir    packages/tokens/src
 * @param {object} options.previous  the live artifact's tokens.json, for prose and order ({} for none)
 * @param {object} options.meta      the provenance note: {ref, synced}
 */
export function buildTokens({ srcDir, previous, meta }) {
  const { resolved: R, order } = resolveThemes(srcDir);
  const prev = previousIndex(previous);
  const report = { newTokens: [], notPlaced: [], keptFromPrevious: [] };
  const usage = (name) => {
    if (prev.has(name)) return prev.get(name).usage;
    report.newTokens.push(name);
    return '';
  };

  const colours = colourTokens({ R, order, prev, usage, report });
  const families = familyTokens({
    R,
    order,
    previous,
    /* A colour already reported as not placed must not be reported again as a family miss. */
    placed: new Set([...colours.map((token) => token.name), ...report.notPlaced]),
    usage,
    report,
  });
  const type = typeStyles({ srcDir, R, previous });

  const json = {
    version: 1,
    meta: {
      source: 'github',
      repo: 'EliRobinson/design-system',
      ref: meta.ref,
      package: 'packages/tokens',
      paths: {
        /* tokens.css is the entry, which @imports the rest. */
        tokens: [
          'tokens.css',
          ...TOKEN_STYLESHEETS.filter((file) => file !== 'tokens.css'),
          ...PLATFORM_STYLESHEETS,
        ].map((file) => `packages/tokens/src/${file}`),
        fonts: ['packages/tokens/src/fonts.css'],
      },
      synced: meta.synced,
      themesLeftOut: THEMES_LEFT_OUT,
    },
    color: {
      themes: ARTIFACT_THEMES.map((id) => ({
        id,
        name: id.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      })),
      tokens: colours,
    },
    type,
  };
  for (const [family, tokens] of families) json[family] = { ...(previous[family] ?? {}), tokens };

  /* Keep the previous file's key order, so the page sections do not move. */
  const ordered = {};
  for (const key of Object.keys(previous)) if (key in json) ordered[key] = json[key];
  for (const key of Object.keys(json)) if (!(key in ordered)) ordered[key] = json[key];

  return {
    json: ordered,
    css: compileTokensCss({ colours, families, type }),
    extrasCss: notInJsonCss({ srcDir, R }),
    report,
  };
}

/** tokens.css in the shape the artifact compiles it to. */
function compileTokensCss({ colours, families, type }) {
  const css = (value) => value.replace(/\{([^}]+)\}/g, 'var(--$1)');
  const shadows = families.get('shadow') ?? [];
  const [first, ...rest] = ARTIFACT_THEMES;
  const lines = ['/* Miltinson Design System — generated from tokens.json */'];
  lines.push(`:root, [data-theme="${first}"] {`);
  for (const token of colours) lines.push(`  --${token.name}: ${css(valueIn(token, first))};`);
  for (const token of shadows) lines.push(`  --${token.name}: ${valueIn(token, first)};`);
  lines.push('}');
  for (const theme of rest) {
    lines.push(`[data-theme="${theme}"] {`);
    for (const token of colours) {
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

/** The token values tokens.json has no grammar for, plus the platform layer verbatim. */
function notInJsonCss({ srcDir, R }) {
  const linkOnFill = new Set(ARTIFACT_THEMES.map((theme) => R[theme].get(`--${LINK_ON_FILL}`)));
  if (linkOnFill.size !== 1) {
    throw new Error(`--${LINK_ON_FILL} differs by theme; it needs a theme block`);
  }
  const root = R[ARTIFACT_THEMES[0]];
  const lines = [
    '/* tokens.css :root and palettes.css (every palette block, light and dark, declares --link-on-fill: currentColor) */',
    ':root {',
    ...NOT_IN_JSON.map((name) => `  --${name}: ${root.get(`--${name}`)};`),
    '}',
    '',
    '/* mobile.css, verbatim: the platform layer, keyed on data-platform and a media query, not on a theme */',
    ...readPlatformStylesheets(srcDir).map((css) => css.trimEnd()),
  ];
  return `${lines.join('\n')}\n`;
}
