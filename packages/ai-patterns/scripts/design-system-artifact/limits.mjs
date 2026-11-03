/* The Design System artifact type's caps, from its artifact-type/reference/format.md.
 * A file over a cap is refused or silently dropped by the page, so the build
 * fails first. */

export const LIMITS = {
  themes: 8,
  colours: 600,
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

/** Throws naming every cap the output breaks. `sizes` maps project path to bytes. */
export function checkLimits({ tokensJson, sizes }) {
  const broken = [];
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
