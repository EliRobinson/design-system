/* Verified against the real design-system-docs/ tree — the manifest's whole
 * job is to be the one true description of it, so the fixtures are the folder
 * itself. Counts that would rot as the folder evolves are derived in the test
 * by an independent walk, never restated. */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import { describe, expect, it } from 'vitest';

import { BLOCK_BEGIN, BLOCK_END } from './brand.mjs';
import { buildBrandManifest, renderRepoIndexTable } from './brand-manifest.mjs';
import { buildGuidelineCards } from './guideline-cards.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const root = join(repoRoot, 'design-system-docs');
const tokens = parseTokensCss(
  readFileSync(join(repoRoot, 'packages/tokens/src/tokens.css'), 'utf8'),
);

const manifest = buildBrandManifest({ root, tokens });
const { artifacts } = manifest;
const byId = (id) => artifacts.find((artifact) => artifact.id === id);

/* An independent walk — plain recursion over dirents, nothing shared with the
   implementation — so the coverage assertion is double-entry, not an echo. */
function everyPath(dir, prefix = '') {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...everyPath(join(dir, entry.name), path));
    } else {
      found.push(path);
    }
  }
  return found;
}

describe('brand manifest coverage', () => {
  it('claims every file on disk, including the symlink find -type f misses', () => {
    const claimed = new Set(artifacts.flatMap((artifact) => artifact.members.map((m) => m.path)));
    for (const path of everyPath(root)) {
      expect(claimed.has(path), `${path} belongs to no artifact`).toBe(true);
    }
    expect(claimed.has('colors_and_type.css')).toBe(true);
  });

  it('gives every artifact exactly one entry member, which is its path', () => {
    for (const artifact of artifacts) {
      const entries = artifact.members.filter((member) => member.role === 'entry');
      expect(entries, artifact.id).toHaveLength(1);
      expect(entries[0].path).toBe(artifact.path);
    }
  });

  it('records the tokens symlink target rather than pretending it is a file', () => {
    const tokensArtifact = byId('colors_and_type');
    expect(tokensArtifact.symlinkTarget).toContain('packages/tokens/src/tokens.css');
    expect(tokensArtifact.ships).toBe(true);
  });
});

describe('guideline cards', () => {
  const cards = artifacts.filter((artifact) => artifact.category === 'guideline-card');

  it('manifests every card in the folder', () => {
    const onDisk = everyPath(join(root, 'guidelines')).filter((path) => path.endsWith('.html'));
    expect(cards).toHaveLength(onDisk.length);
  });

  it('marks exactly the cards buildGuidelineCards emits as generated', () => {
    const generated = new Set(
      cards.filter((card) => card.origin === 'generated').map((card) => card.path),
    );
    expect(generated).toEqual(
      new Set(buildGuidelineCards(tokens).map((card) => `guidelines/${card.path}`)),
    );
    for (const card of cards) {
      if (card.origin === 'generated') {
        expect(card.generatedBy).toContain('guideline-cards.mjs');
      }
    }
    /* The editorial cards are writing, not derivation — a generated origin on
       one of these would mean the roster import broke. */
    expect(byId('guidelines/brand-voice').origin).toBe('hand-authored');
    expect(byId('guidelines/colors-ink').origin).toBe('generated');
  });

  it('parses title, group, and viewport from the @dsCard marker', () => {
    const ink = byId('guidelines/colors-ink');
    expect(ink.title).toBe('Ink scale');
    expect(ink.group).toBe('Colors');
    expect(ink.render.viewport).toEqual({ width: 700, height: 140 });
  });

  it('records dependencies as written and keeps the stylesheet chain first-party', () => {
    const focus = byId('guidelines/focus');
    expect(focus.render.stylesheets).toEqual(['../styles.css']);
    /* The fonts ride the same chain — styles.css → colors_and_type.css →
       fonts.css — but from the package now, not Google Fonts, so the chain
       names no external origin at all. */
    expect(focus.render.externalOrigins).toEqual([]);
  });
});

describe('ui kits', () => {
  it('models a kit as entry + doc + sources, shipping, needing an HTTP origin', () => {
    const webapp = byId('ui_kits/webapp');
    expect(webapp.category).toBe('ui-kit');
    expect(webapp.ships).toBe(true);
    expect(webapp.render.requiresHttpOrigin).toBe(true);
    expect(webapp.render.standalone).toBe(false);
    expect(webapp.render.externalOrigins).toContain('unpkg.com');
    const roles = Object.fromEntries(webapp.members.map((m) => [m.path.split('/').pop(), m.role]));
    expect(roles['index.html']).toBe('entry');
    expect(roles['README.md']).toBe('doc');
    expect(roles['Components.jsx']).toBe('source');
  });

  it('derives what a kit actually defines instead of trusting prose', () => {
    /* The old hand-kept index claimed the webapp kit covered "auth" — the
       auth kit lives in _project-mirror and does not ship. */
    expect(byId('ui_kits/webapp').components).toEqual([
      'Sidebar',
      'TopBar',
      'StatCard',
      'ProjectsTable',
    ]);
  });

  it('ships the shared primitives the kits load', () => {
    const shared = byId('ui_kits/_shared/Primitives');
    expect(shared.category).toBe('support-file');
    expect(shared.ships).toBe(true);
  });
});

describe('the project mirror', () => {
  const mirrored = artifacts.filter((artifact) => artifact.origin === 'mirrored');

  it('is manifested but never ships and never renders', () => {
    expect(mirrored.length).toBeGreaterThan(0);
    for (const artifact of mirrored) {
      if (artifact.path.startsWith('_project-mirror/')) {
        expect(artifact.ships, artifact.id).toBe(false);
      }
      if (artifact.render) {
        expect(artifact.render.blockedBy.join(' '), artifact.id).toContain('_ds_bundle');
      }
    }
  });

  it('derives the kit count from the directory, so porting a kit shrinks it', () => {
    const kitDirs = readdirSync(join(root, '_project-mirror/ui_kits'), {
      withFileTypes: true,
    }).filter((entry) => entry.isDirectory());
    const mirrorKits = mirrored.filter((artifact) => artifact.category === 'ui-kit');
    expect(mirrorKits).toHaveLength(kitDirs.length);
  });
});

describe('working material', () => {
  it('keeps preview and uploads out of the tarball with the reason cited', () => {
    for (const artifact of artifacts) {
      const top = artifact.path.split('/')[0];
      if (top === 'preview' || top === 'uploads') {
        expect(artifact.ships, artifact.id).toBe(false);
        expect(artifact.shipReason).toContain(`does not list "${top}"`);
      }
    }
    /* uploads/ is scratch space for pasted chat material (issue #56) — kept
       empty on disk apart from a .gitkeep, so anything that lands there next
       is still manifested as incidental rather than silently shipping. */
    const uploads = artifacts.filter((artifact) => artifact.path.startsWith('uploads/'));
    expect(uploads.length).toBeGreaterThan(0);
    for (const artifact of uploads) {
      expect(artifact.category, artifact.id).toBe('scratch');
      expect(artifact.origin, artifact.id).toBe('incidental');
    }
  });

  it('records the preview width the cards inherit from _card.css', () => {
    const preview = artifacts.filter((artifact) => artifact.category === 'preview-card');
    expect(preview.length).toBeGreaterThan(0);
    for (const card of preview) {
      expect(card.render.viewport.width).toBe(700);
    }
  });
});

describe('the in-repo index table', () => {
  const table = renderRepoIndexTable(manifest);

  it('describes what is on disk, not what used to be', () => {
    expect(table).toContain('`patterns/email/`');
    expect(table).not.toContain('templates/');
    /* Four slide templates exist; the old table named a fifth, "comparison". */
    expect(table).not.toContain('comparison');
    /* The webapp kit exports these — the old table claimed "auth". */
    expect(table).toContain('ProjectsTable');
    expect(table).not.toMatch(/webapp[^|]*\|[^|]*auth/);
  });

  it('covers every top-level entry, including the ones the old table omitted', () => {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.name === 'README.md') {
        continue;
      }
      expect(table, entry.name).toContain(`\`${entry.name}`);
    }
  });

  it('is what design-system-docs/README.md actually contains', () => {
    /* The table is generated in place by build-artifacts.mjs; this pins the
       committed file to the generator so a hand edit or a new folder fails
       here until the build regenerates it. */
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    const block = readme.slice(
      readme.indexOf(BLOCK_BEGIN) + BLOCK_BEGIN.length,
      readme.indexOf(BLOCK_END),
    );
    expect(block).toContain(table);
  });
});
