/* Reads token names, values, and their inline comments straight out of the
   published tokens.css, so the foundations pages render whatever the package
   ships today — they cannot drift from it. Server-side only. */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Resolved through the workspace symlink rather than require.resolve — the
   bundler would otherwise try to treat the CSS file as an importable module
   asset. The exports map pins ./tokens.css to ./src/tokens.css, so this path
   is the same file a consumer gets. */
const TOKENS_CSS_PATH = join(process.cwd(), 'node_modules/@elirobinson/tokens/src/tokens.css');

export type TokenEntry = {
  name: string; // e.g. "--ink-500"
  value: string; // raw declared value, may be var(--…)
  resolved: string; // var() chains followed to a concrete value
  comment: string | null;
};

let cache: TokenEntry[] | null = null;

export function cssTokens(): TokenEntry[] {
  if (cache) {
    return cache;
  }
  const css = readFileSync(TOKENS_CSS_PATH, 'utf8');
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const raw = [...root.matchAll(/(--[\w-]+):\s*([^;]+);(?:[ \t]*\/\*\s*([\s\S]*?)\s*\*\/)?/g)].map(
    (m) => ({
      name: m[1],
      value: m[2].trim(),
      comment: m[3]?.replace(/\s+/g, ' ') ?? null,
    }),
  );

  const byName = new Map(raw.map((t) => [t.name, t.value]));
  const resolve = (value: string, depth = 0): string => {
    if (depth > 8) {
      return value;
    }
    return value.replace(/var\((--[\w-]+)\)/g, (whole, name: string) => {
      const target = byName.get(name);
      return target ? resolve(target, depth + 1) : whole;
    });
  };

  cache = raw.map((t) => ({ ...t, resolved: resolve(t.value) }));
  return cache;
}

export function tokensByPrefix(prefix: string): TokenEntry[] {
  return cssTokens().filter((t) => t.name.startsWith(`--${prefix}-`));
}

/* Last declaration wins, as in CSS — --status-success/--status-warning are
   declared in the base scale and then re-pointed at brand colors in the
   semantic section. */
export function getToken(name: string): TokenEntry | undefined {
  const matches = cssTokens().filter((t) => t.name === name);
  return matches[matches.length - 1];
}
