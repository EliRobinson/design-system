/* The site's machine-readable surface: /llms.txt, /llms-full.txt, and the
   /r/[component].json records.

   The corpus itself is built by `@elirobinson/ai-patterns/corpus` — the same
   generator that stages the offline snapshot in that package's tarball. This
   module is the docs site's half of that contract and nothing else: it reads
   the manifest, the live tokens.css and the contracts, turns the MDX pages the
   humans read into plain markdown, and hands all of it over. What used to live
   here was a second implementation of the generator that happened to agree with
   the first. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import contracts from '@elirobinson/ai-patterns/contracts';
import {
  llmsFull as buildFull,
  llmsIndex as buildIndex,
  type Contracts,
} from '@elirobinson/ai-patterns/corpus';

import type { ComponentRecord } from './manifest';
import { components, hooks, TIERS } from './manifest';
import { siteSections } from './site-map';
import { cssTokens } from './tokens-css';

const APP_DIR = join(process.cwd(), 'src/app/(docs)');

/* What a reader of /llms.txt can fetch next. The packed snapshot answers the
   same question with filenames and the `ds` CLI; a website answers it with
   URLs, which is why the generator takes this rather than guessing. */
const MACHINE_READABLE_DOCS = {
  heading: 'Machine-readable docs',
  entries: [
    '- /llms-full.txt — the full corpus: tokens, constraints, every component with its prop table, patterns',
    '- /r/<slug>.json — one component record (e.g. /r/button.json)',
  ],
};

/* The generator reads the manifest structurally, naming only the fields it
   renders — including `tiers`, so a tier @elirobinson/react adds shows up here
   by bumping a version rather than by editing a list. */
const manifest = { tiers: TIERS, components, hooks };

function pagePath(href: string): string {
  return join(APP_DIR, href.replace(/^\//, ''), 'page.mdx');
}

/* MDX → plain markdown: drop imports/exports and JSX tag lines, convert
   DoDont blocks to lists, keep prose, headings, and code fences. */
export function stripMdx(source: string): string {
  const withDoDont = source.replace(/<DoDont[\s\S]*?\/>/g, (block) => {
    const list = (name: string) => {
      const match = block.match(new RegExp(`${name}=\\{\\[([\\s\\S]*?)\\]\\}`));
      if (!match) {
        return [];
      }
      return [...match[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"));
    };
    const doItems = list('do').map((item) => `- ${item}`);
    const dontItems = list('dont').map((item) => `- ${item}`);
    return `Do:\n${doItems.join('\n')}\n\nDon't:\n${dontItems.join('\n')}`;
  });

  const out: string[] = [];
  let inFence = false;
  for (const line of withDoDont.split('\n')) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export const metadata')) {
      continue;
    }
    if (/^<\/?[A-Za-z]/.test(trimmed) || trimmed === '/>' || trimmed === '>') {
      continue;
    }
    out.push(line);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pageProse(href: string): string | null {
  const path = pagePath(href);
  if (!existsSync(path)) {
    return null;
  }
  return stripMdx(readFileSync(path, 'utf8'));
}

/** Every page of a named site section that has prose, in sidebar order. */
function sectionProse(title: string): string[] {
  const section = siteSections().find((s) => s.title === title);
  if (!section) {
    return [];
  }
  return section.pages.map((page) => pageProse(page.href)).filter((prose) => prose !== null);
}

/* What the docs site has and a packed snapshot does not: the component's own
   page, and a URL for its record. */
function componentAppendix(component: ComponentRecord): string[] {
  const blocks: string[] = [];
  const prose = pageProse(`/components/${component.slug}`);
  if (prose) {
    /* Drop the H1 (the section heading the generator emits carries the name)
       and demote the page's H2s so they nest under its H3. */
    blocks.push(
      prose
        .replace(/^# .*\n/, '')
        .replace(/^## /gm, '#### ')
        .trim(),
    );
  }
  blocks.push(`Machine-readable record: /r/${component.slug}.json`);
  return blocks;
}

export function llmsIndex(): string {
  return buildIndex({ manifest, alsoAvailable: MACHINE_READABLE_DOCS });
}

export function llmsFull(): string {
  return buildFull({
    manifest,
    contracts: contracts as Contracts,
    tokens: cssTokens(),
    prose: { foundations: sectionProse('Foundations'), patterns: sectionProse('Patterns') },
    componentAppendix,
  });
}

export function recordSlugs(): string[] {
  return components.map((c) => c.slug);
}

export function componentRecord(slug: string): (ComponentRecord & { docs: string }) | null {
  const component = components.find((c) => c.slug === slug);
  if (!component) {
    return null;
  }
  return { ...component, docs: `/components/${component.slug}` };
}
