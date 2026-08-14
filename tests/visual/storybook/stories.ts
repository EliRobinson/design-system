import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* cwd, not a path derived from import.meta.url: playwright.config.ts imports
   this module, and the config is transpiled to CJS (the root package.json has
   no "type": "module"), where import.meta is a syntax error. Every entry point
   is a pnpm script, and pnpm runs those from the package directory, so cwd is
   the repo root. */
const repoRoot = process.cwd();

export const STORYBOOK_DIR = 'apps/storybook/storybook-static';
export const STORYBOOK_PORT = 6007;
export const STORYBOOK_URL = `http://127.0.0.1:${STORYBOOK_PORT}`;

export type Story = {
  id: string;
  title: string;
  name: string;
};

type IndexEntry = Story & { type: string };

/** Every story in the built Storybook, sorted so the run order is stable.
 *
 *  Read from the build's own index rather than from a list kept here: adding a
 *  component with a story is then all it takes to get visual coverage, which is
 *  what AGENTS.md requires of anything we publish. The index also carries
 *  `docs` entries — autodocs pages, not stories — which render a whole page of
 *  generated prose and are not what this suite is measuring. */
export function stories(): Story[] {
  const indexPath = join(repoRoot, STORYBOOK_DIR, 'index.json');

  let raw: string;
  try {
    raw = readFileSync(indexPath, 'utf8');
  } catch {
    throw new Error(
      `No Storybook index at ${indexPath}.\n` +
        'The visual suite reads it to enumerate stories — build Storybook first ' +
        '(`pnpm test:visual` does this for you).',
    );
  }

  const entries: Record<string, IndexEntry> = JSON.parse(raw).entries;

  return Object.values(entries)
    .filter((entry) => entry.type === 'story')
    .map(({ id, title, name }) => ({ id, title, name }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The isolated render of one story, without Storybook's own UI around it. */
export function storyUrl(id: string): string {
  return `${STORYBOOK_URL}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`;
}
