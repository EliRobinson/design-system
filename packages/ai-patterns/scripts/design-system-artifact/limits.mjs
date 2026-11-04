/* The Design System artifact type's caps, from its artifact-type/reference/format.md.
 * A file over a cap is refused or silently dropped by the page, so the build
 * fails first. */

export const LIMITS = {
  themes: 8,
  colours: 600,
  /* A non-colour family holds at most this many tokens. */
  familyTokens: 60,
  /* One publish call takes at most 255 paths. */
  files: 255,
  bytes: {
    'tokens.json': 512 * 1024,
    'components/bundle.js': 6 * 1024 * 1024,
    'components/bundle.css': 2 * 1024 * 1024,
  },
  typesBytes: 1.5 * 1024 * 1024,
  fontBytes: 1024 * 1024,
};

/* format.md: only colours may alias, and no value holds var(). */
function grammarBreaks(tokensJson) {
  const broken = [];
  for (const [family, entry] of Object.entries(tokensJson)) {
    if (family === 'color' || family === 'type' || !Array.isArray(entry?.tokens)) continue;
    if (entry.tokens.length > LIMITS.familyTokens) {
      broken.push(`${family} has ${entry.tokens.length} tokens (max ${LIMITS.familyTokens})`);
    }
    for (const token of entry.tokens) {
      const values = typeof token.value === 'string' ? [token.value] : Object.values(token.value);
      if (values.some((value) => /var\(|\{/.test(value))) {
        broken.push(
          `${family} ${token.name} is not a literal value: ${JSON.stringify(token.value)}`,
        );
      }
    }
  }
  for (const style of (tokensJson.type?.groups ?? []).flatMap((group) => group.styles)) {
    for (const key of ['fontSize', 'lineHeight', 'letterSpacing']) {
      if (style[key]?.includes('var(')) broken.push(`type ${style.name} ${key} is ${style[key]}`);
    }
    if ('fontWeight' in style && !Number.isInteger(style.fontWeight)) {
      broken.push(`type ${style.name} fontWeight is ${style.fontWeight}`);
    }
  }
  return broken;
}

/** Throws naming every cap or grammar rule the output breaks. `sizes` maps project path to bytes. */
export function checkLimits({ tokensJson, sizes }) {
  const broken = grammarBreaks(tokensJson);
  const themes = tokensJson.color.themes.length;
  if (themes > LIMITS.themes) broken.push(`${themes} themes (max ${LIMITS.themes})`);
  const colours = tokensJson.color.tokens.length;
  if (colours > LIMITS.colours) broken.push(`${colours} colours (max ${LIMITS.colours})`);
  const paths = Object.keys(sizes);
  if (paths.length > LIMITS.files)
    broken.push(`${paths.length} files (max ${LIMITS.files} per publish)`);
  for (const [path, max] of Object.entries(LIMITS.bytes)) {
    if ((sizes[path] ?? 0) > max) broken.push(`${path} is ${sizes[path]} bytes (max ${max})`);
  }
  const types = paths
    .filter((path) => path.endsWith('.d.ts'))
    .reduce((sum, path) => sum + sizes[path], 0);
  if (types > LIMITS.typesBytes)
    broken.push(`types total ${types} bytes (max ${LIMITS.typesBytes})`);
  for (const path of paths.filter((p) => p.startsWith('fonts/'))) {
    if (sizes[path] > LIMITS.fontBytes)
      broken.push(`${path} is ${sizes[path]} bytes (max ${LIMITS.fontBytes})`);
  }
  if (broken.length)
    throw new Error(`the artifact would refuse this output:\n  ${broken.join('\n  ')}`);
}
