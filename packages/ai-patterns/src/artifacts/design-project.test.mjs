/* The two design-project documents that are neither API nor token data.
 *
 * These were inline in scripts/build-design-project.mjs and untested, which is
 * how the provenance note came to claim five ui kits while the project carried
 * thirteen.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTokensCss } from '@elirobinson/tokens/parse-tokens-css';
import { readTokenStylesheets } from '@elirobinson/tokens/token-stylesheets';
import { describe, expect, it } from 'vitest';

import {
  buildDocsStylesheet,
  buildProvenanceDoc,
  pushBoundary,
  toPosix,
} from './design-project.mjs';
import { buildGuidelineCards } from './guideline-cards.mjs';

const manifest = {
  package: '@elirobinson/react',
  version: '2.0.0',
  components: Array.from({ length: 44 }, (_, i) => ({ name: `C${i}` })),
};

const provenance = (overrides = {}) =>
  buildProvenanceDoc({
    target: { repo: 'EliRobinson/design-system', branch: 'main' },
    manifest,
    stylesheetCount: 41,
    tokenCount: 196,
    cardCount: 13,
    kits: { shared: 4, projectOnly: 9 },
    ...overrides,
  });

describe('pushBoundary', () => {
  /* All three token layers, because that is what the bundle carries: tokens.css
     `@import`s the other two with relative specifiers, and a boundary naming
     only tokens.css would reject the push that carries them — or, worse, admit
     one that pushes a stylesheet with two dangling imports. */
  const tokenWrites = ['tokens/palettes.css', 'tokens/tokens.css', 'tokens/mobile.css'];
  const target = { projectId: 'x', writes: tokenWrites, deletes: [] };

  it('covers every card the generator actually emits', () => {
    // The real pairing, not a fixture: a card added to the generator must land
    // inside the write boundary automatically, or the push rejects it.
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const cards = buildGuidelineCards(
      parseTokensCss(readTokenStylesheets(join(repoRoot, 'packages/tokens/src'))),
    );
    const { writes } = pushBoundary(target, cards);
    for (const { path } of cards) expect(writes).toContain(`guidelines/${path}`);
  });

  it('admits every token layer the bundle writes', () => {
    const { writes } = pushBoundary(target, []);
    for (const path of tokenWrites) expect(writes).toContain(path);
  });

  it('grows with the roster instead of being restated', () => {
    const { writes } = pushBoundary(target, [{ path: 'a.html' }, { path: 'b.html' }]);
    expect(writes).toEqual([...tokenWrites, 'guidelines/a.html', 'guidelines/b.html']);
  });

  it('leaves the project-owned editorial cards outside the boundary', () => {
    const { writes } = pushBoundary(target, [{ path: 'colors-ink.html' }]);
    expect(writes).not.toContain('guidelines/brand-voice.html');
    expect(writes).not.toContain('guidelines/type-body.html');
  });

  it('carries the rest of the target through untouched', () => {
    expect(pushBoundary(target, []).projectId).toBe('x');
    expect(pushBoundary(target, []).deletes).toEqual([]);
  });
});

describe('toPosix', () => {
  it('normalises separators so a Windows walk emits the same import', () => {
    expect(toPosix('organisms\\table\\core.css')).toBe('organisms/table/core.css');
    expect(toPosix('atoms/Button.css')).toBe('atoms/Button.css');
  });
});

describe('buildDocsStylesheet', () => {
  it('imports the tokens symlink first, then every component sheet', () => {
    const css = buildDocsStylesheet(['atoms/Button.css', 'organisms/table/core.css']);
    const imports = css.match(/@import '[^']+'/g);
    expect(imports[0]).toBe("@import './colors_and_type.css'");
    expect(imports).toHaveLength(3);
  });

  it('points at the real stylesheets rather than copying them', () => {
    // A copy is what goes stale; the whole reason this file is generated.
    expect(buildDocsStylesheet(['atoms/Button.css'])).toContain(
      "@import '../packages/react/src/components/atoms/Button.css'",
    );
  });

  it('says how to regenerate it, in the file itself', () => {
    expect(buildDocsStylesheet(['atoms/Button.css'])).toContain('build:design-project');
  });

  it('refuses to emit a stylesheet that imports nothing', () => {
    expect(() => buildDocsStylesheet([])).toThrow(/no component stylesheets/);
  });
});

describe('buildProvenanceDoc', () => {
  it('reports the total kit count, not one side of it', () => {
    // The hand-written copy said five when the project had thirteen.
    expect(provenance()).toContain('13 ui kits');
  });

  it('breaks the total into shared and project-only', () => {
    const doc = provenance();
    expect(doc).toContain("4 that also ship from the repo's `ui_kits/`");
    expect(doc).toContain('9 mirrored');
  });

  it('says where the kit figure came from, so a stale one is legible as stale', () => {
    // It counts the repo's mirror, which lags the project. Say so rather than
    // implying the number was read from the project itself.
    expect(provenance()).toMatch(/as of the last mirror|Counted from that\n {2}mirror/);
  });

  it('tracks the counts it is given rather than restating fixed numbers', () => {
    const doc = provenance({
      cardCount: 12,
      tokenCount: 210,
      kits: { shared: 4, projectOnly: 10 },
    });
    expect(doc).toContain('12 generated foundation cards');
    expect(doc).toContain('210 design tokens');
    expect(doc).toContain('14 ui kits');
  });

  it('stamps the version the adherence config was generated from', () => {
    expect(provenance()).toContain('`@elirobinson/react@2.0.0`');
  });

  it('names both sides of the ownership split', () => {
    const doc = provenance();
    expect(doc).toContain('Owned by the repo');
    expect(doc).toContain('Owned by this project');
  });
});
