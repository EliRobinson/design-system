/* The brand layer's manifest — the spine the docs site, the packed skill, and
 * the MCP server read, the way they read `@elirobinson/react/manifest` for
 * components. `design-system-docs/` is a folder of hand-authored HTML; this
 * module walks it and emits one record per *artifact* (a UI kit is an entry
 * point plus sources plus a README, and only the entry point renders).
 *
 * Three inventory facts shape the implementation and must not be simplified
 * away:
 *
 * - Generated and hand-authored guideline cards are indistinguishable on
 *   disk — same `@dsCard` marker, same minification, same stylesheet. The
 *   only authority for which is which is `buildGuidelineCards`, so this
 *   module imports it and reads the paths it emits. A hardcoded list here
 *   would be exactly the drift this manifest exists to remove.
 * - Three stylesheet conventions coexist (`../styles.css`, a sibling
 *   `_card.css`, `colors_and_type.css` at varying depths). Each artifact's
 *   dependencies are recorded as written, never normalised.
 * - Some paths escape the folder: `colors_and_type.css`, `fonts.css`, and
 *   everything under `fonts/` are symlinks into `packages/tokens` (which
 *   `find -type f` misses — the walker uses dirents and records the target),
 *   and the generated `styles.css` `@import`s the real component stylesheets
 *   from `packages/react`.
 *
 * Every file the walker finds must be claimed by some artifact's members;
 * an unclaimed file is a hard error, so a new folder cannot be silently
 * invisible the way `guidelines/` was to the old hand-kept index table.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve as resolvePath, sep } from 'node:path';

import { buildGuidelineCards } from './guideline-cards.mjs';

/* Copied verbatim into the consumer tarball by build-artifacts.mjs. Anything
   not listed is repo-internal — that allow-list is the entire ships rule.
   fonts.css and fonts/ travel with colors_and_type.css: it @imports
   './fonts.css', so shipping the stylesheet without the faces would leave a
   dangling import in every consumer's skill. */
export const BRAND_SOURCES = ['colors_and_type.css', 'fonts.css', 'fonts', 'assets', 'ui_kits'];

const GUIDELINE_CARDS_MODULE = 'packages/ai-patterns/src/artifacts/guideline-cards.mjs';
const STYLES_GENERATOR = 'packages/ai-patterns/scripts/build-design-project.mjs';

/* Recorded rather than parsed: preview/_card.css pins `width: 700px` (height
   is per-card), and the slide templates are fixed 16:9 frames. Neither file
   set carries a `@dsCard viewport` attribute to read. */
const PREVIEW_VIEWPORT = { width: 700, height: null };
const SLIDE_VIEWPORT = { width: 1280, height: 720 };

/** Every path under `dir` as forward-slash relative paths, symlinks included. */
function walkFiles(root, dir = root) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkFiles(root, path));
    } else {
      found.push({
        path: path
          .slice(root.length + 1)
          .split(sep)
          .join('/'),
        symlinkTarget: entry.isSymbolicLink() ? readlinkSync(path) : null,
      });
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function parseDsCard(html) {
  const marker = html.match(/<!--\s*@dsCard\s+([^>]*?)-->/);
  if (!marker) {
    return null;
  }
  const attr = (name) => marker[1].match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
  const viewport = attr('viewport')?.match(/^(\d+)x(\d+)$/);
  const decode = (text) =>
    text === null ? null : text.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return {
    group: decode(attr('group')),
    name: decode(attr('name')),
    subtitle: decode(attr('subtitle')),
    viewport: viewport ? { width: Number(viewport[1]), height: Number(viewport[2]) } : null,
  };
}

function htmlTitle(html) {
  return html.match(/<title>([^<]*)<\/title>/)?.[1].trim() ?? null;
}

function markdownH1(markdown) {
  return markdown.match(/^#\s+(.+)$/m)?.[1].trim() ?? null;
}

function stylesheetLinks(html) {
  return [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => !/^https?:/.test(href));
}

/* Only positions that actually fetch: src/href attributes in HTML, url() and
   @import in CSS. A blanket URL scan would also catch xmlns namespace URIs,
   which are identifiers, not network dependencies. */
const HTML_FETCH_PATTERN = /(?:src|href)="(https?:\/\/[^"]+)"/g;
const CSS_FETCH_PATTERN = /(?:url\(\s*['"]?|@import\s+['"])(https?:\/\/[^'")]+)/g;

function hostOf(url) {
  return url.replace(/^https?:\/\//, '').split(/[/?#]/)[0];
}

/**
 * External origins reachable from an entry file: what the file itself names,
 * plus what its relative stylesheet chain names — a card that links a
 * stylesheet inherits its network dependencies. Local @imports are followed;
 * the scan is cached because `styles.css` imports every component stylesheet.
 * (The fonts used to make every chain name fonts.googleapis.com; they are
 * self-hosted now, so a first-party chain reports no origins at all.)
 */
function originScanner() {
  const cssCache = new Map();

  function cssOrigins(absolutePath, seen = new Set()) {
    const key = resolvePath(absolutePath);
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    if (cssCache.has(key)) {
      return cssCache.get(key);
    }
    let source;
    try {
      source = readFileSync(key, 'utf8');
    } catch {
      return []; // a dangling link is the artifact's own defect, not the scanner's
    }
    const origins = new Set(
      [...source.matchAll(CSS_FETCH_PATTERN)].map((match) => hostOf(match[1])),
    );
    for (const match of source.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) {
      if (!/^https?:/.test(match[1])) {
        for (const origin of cssOrigins(join(dirname(key), match[1]), seen)) {
          origins.add(origin);
        }
      }
    }
    const result = [...origins].sort();
    cssCache.set(key, result);
    return result;
  }

  return function originsOf(root, entryPath, contents) {
    const origins = new Set(
      [...contents.matchAll(HTML_FETCH_PATTERN)].map((match) => hostOf(match[1])),
    );
    for (const href of stylesheetLinks(contents)) {
      for (const origin of cssOrigins(join(root, dirname(entryPath), href))) {
        origins.add(origin);
      }
    }
    return [...origins].sort();
  };
}

function shipsFor(path) {
  if (path === 'README.md' || path === 'SKILL.md') {
    return {
      ships: true,
      shipReason: 'staged as a transformed copy — managed blocks regenerated at pack time',
    };
  }
  const top = path.split('/')[0];
  if (BRAND_SOURCES.includes(top)) {
    return { ships: true, shipReason: `BRAND_SOURCES lists "${top}"` };
  }
  return { ships: false, shipReason: `BRAND_SOURCES does not list "${top}"` };
}

/** Top-level components a kit defines: `const PascalCase =` / `function PascalCase`. */
function kitComponents(root, sourcePaths) {
  const names = [];
  for (const path of sourcePaths) {
    const source = readFileSync(join(root, path), 'utf8');
    for (const match of source.matchAll(
      /^(?:export )?(?:function|const) ([A-Z][A-Za-z0-9]*)\s*[=(]/gm,
    )) {
      names.push(match[1]);
    }
  }
  return names;
}

/**
 * @param {object} input
 * @param {string} input.root absolute path of design-system-docs/
 * @param {Array<{name: string}>} input.tokens parsed tokens.css, for buildGuidelineCards
 */
export function buildBrandManifest({ root, tokens }) {
  const files = walkFiles(root);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const under = (prefix) => files.filter((file) => file.path.startsWith(`${prefix}/`));
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const originsOf = originScanner();

  const generatedCardPaths = new Set(
    buildGuidelineCards(tokens).map((card) => `guidelines/${card.path}`),
  );

  const artifacts = [];

  /* One artifact. `entry` is the file that renders (or the single file);
     everything else rides along as members. */
  function add({
    id,
    entry,
    category,
    title,
    group = null,
    origin,
    generatedBy = null,
    members,
    render = null,
    subtitle = null,
    components = null,
  }) {
    const file = byPath.get(entry);
    if (!file) {
      throw new Error(`brand manifest: entry "${entry}" is not on disk.`);
    }
    const memberHashes = members.map((member) => ({
      ...member,
      hash: sha256(readFileSync(join(root, member.path))),
    }));
    const hash =
      memberHashes.length === 1
        ? memberHashes[0].hash
        : sha256(memberHashes.map((member) => `${member.path} ${member.hash}`).join('\n'));

    artifacts.push({
      id,
      path: entry,
      category,
      title,
      ...(subtitle === null ? {} : { subtitle }),
      group,
      origin,
      ...(generatedBy === null ? {} : { generatedBy }),
      ...(file.symlinkTarget === null ? {} : { symlinkTarget: file.symlinkTarget }),
      ...shipsFor(entry),
      ...(components === null ? {} : { components }),
      members: memberHashes.map(({ path, role }) => ({ path, role })),
      render,
      sha256: hash,
    });
  }

  /* HTML render facts, read from the file as written. */
  function renderOf(entry, { viewport = null, blockedBy = [] } = {}) {
    const contents = read(entry);
    const requiresHttpOrigin = /type="text\/babel"/.test(contents);
    return {
      standalone: !requiresHttpOrigin && blockedBy.length === 0,
      requiresHttpOrigin,
      externalOrigins: originsOf(root, entry, contents),
      stylesheets: stylesheetLinks(contents),
      viewport,
      blockedBy,
    };
  }

  /* -- Top-level docs and stylesheets ------------------------------------ */
  add({
    id: 'README',
    entry: 'README.md',
    category: 'brand-doc',
    title: markdownH1(read('README.md')) ?? 'README',
    origin: 'hand-authored',
    members: [{ path: 'README.md', role: 'entry' }],
  });
  add({
    id: 'SKILL',
    entry: 'SKILL.md',
    category: 'brand-doc',
    title: 'Agent skill entry point',
    origin: 'hand-authored',
    members: [{ path: 'SKILL.md', role: 'entry' }],
  });
  add({
    id: 'colors_and_type',
    entry: 'colors_and_type.css',
    category: 'tokens',
    title: 'Brand tokens',
    origin: 'mirrored',
    members: [{ path: 'colors_and_type.css', role: 'entry' }],
  });
  add({
    id: 'styles',
    entry: 'styles.css',
    category: 'aggregate-stylesheet',
    title: 'Aggregate stylesheet',
    origin: 'generated',
    generatedBy: STYLES_GENERATOR,
    members: [{ path: 'styles.css', role: 'entry' }],
  });

  /* -- Self-hosted webfonts — mirrored from packages/tokens the same way
        colors_and_type.css is, one symlink per file. --------------------- */
  add({
    id: 'fonts',
    entry: 'fonts.css',
    category: 'support-file',
    title: 'Self-hosted webfonts',
    origin: 'mirrored',
    members: [{ path: 'fonts.css', role: 'entry' }],
  });
  for (const file of under('fonts')) {
    add({
      id: file.path.replace(/\.[a-z0-9]+$/, ''),
      entry: file.path,
      category: 'asset',
      title: file.path.split('/').pop(),
      group: 'fonts',
      origin: 'mirrored',
      members: [{ path: file.path, role: 'entry' }],
    });
  }

  /* -- Assets ------------------------------------------------------------ */
  for (const file of under('assets')) {
    add({
      id: file.path.replace(/\.[a-z]+$/, ''),
      entry: file.path,
      category: 'asset',
      title: file.path.split('/').pop(),
      group: 'assets',
      origin: 'hand-authored',
      members: [{ path: file.path, role: 'entry' }],
      render: renderOf(file.path),
    });
  }

  /* -- Guideline cards. Origin comes from buildGuidelineCards — the eleven
        paths it emits are generated, everything else in the folder is
        editorial writing. File inspection cannot recover this distinction. */
  for (const file of under('guidelines')) {
    const contents = read(file.path);
    const card = parseDsCard(contents);
    if (!card) {
      throw new Error(`brand manifest: ${file.path} carries no @dsCard marker.`);
    }
    const generated = generatedCardPaths.has(file.path);
    add({
      id: file.path.replace(/\.html$/, ''),
      entry: file.path,
      category: 'guideline-card',
      title: card.name ?? file.path,
      subtitle: card.subtitle,
      group: card.group,
      origin: generated ? 'generated' : 'hand-authored',
      generatedBy: generated ? GUIDELINE_CARDS_MODULE : null,
      members: [{ path: file.path, role: 'entry' }],
      render: renderOf(file.path, { viewport: card.viewport }),
    });
  }

  /* -- Component specimen cards. Same `@dsCard` shape as a guideline card,
        but they specimen a component tier rather than a token ramp, and none
        of them is generated — the roster is whatever is on disk. Grouped by
        the tier directory they sit in, so `components/ai/` needs no edit here
        the way a new tier needs none in the component manifest. ------------ */
  for (const file of under('components')) {
    const contents = read(file.path);
    const card = parseDsCard(contents);
    if (!card) {
      throw new Error(`brand manifest: ${file.path} carries no @dsCard marker.`);
    }
    add({
      id: file.path.replace(/\.card\.html$/, '').replace(/\.html$/, ''),
      entry: file.path,
      category: 'component-card',
      title: card.name ?? file.path,
      subtitle: card.subtitle,
      group: card.group,
      origin: 'hand-authored',
      members: [{ path: file.path, role: 'entry' }],
      render: renderOf(file.path, { viewport: card.viewport }),
    });
  }

  /* -- Preview cards (working material; the pinned 700px width lives in
        _card.css, not in the cards) --------------------------------------- */
  add({
    id: 'preview/_card',
    entry: 'preview/_card.css',
    category: 'support-file',
    title: '_card.css',
    group: 'preview',
    origin: 'hand-authored',
    members: [{ path: 'preview/_card.css', role: 'entry' }],
  });
  for (const file of under('preview')) {
    if (file.path === 'preview/_card.css') {
      continue;
    }
    add({
      id: file.path.replace(/\.html$/, ''),
      entry: file.path,
      category: 'preview-card',
      title: htmlTitle(read(file.path)) ?? file.path,
      group: 'preview',
      origin: 'hand-authored',
      members: [{ path: file.path, role: 'entry' }],
      render: renderOf(file.path, { viewport: PREVIEW_VIEWPORT }),
    });
  }

  /* -- Slides ------------------------------------------------------------ */
  for (const file of under('slides')) {
    const isTemplate = file.path !== 'slides/index.html';
    add({
      id: file.path.replace(/\.html$/, ''),
      entry: file.path,
      category: 'slide',
      title: htmlTitle(read(file.path)) ?? file.path,
      group: 'slides',
      origin: 'hand-authored',
      members: [{ path: file.path, role: 'entry' }],
      render: renderOf(file.path, { viewport: isTemplate ? SLIDE_VIEWPORT : null }),
    });
  }

  /* -- Patterns: one artifact per renderable page; the directory's README
        and any support script ride along on each. ------------------------- */
  const patternDirs = new Set(under('patterns').map((file) => file.path.split('/')[1]));
  for (const dir of [...patternDirs].sort()) {
    const dirFiles = under(`patterns/${dir}`);
    const entries = dirFiles.filter((file) => file.path.endsWith('.html'));
    const doc = dirFiles.find((file) => file.path.endsWith('README.md'));
    const scripts = dirFiles.filter((file) => file.path.endsWith('.js'));
    for (const entry of entries) {
      add({
        id: entry.path.replace(/\.html$/, ''),
        entry: entry.path,
        category: 'pattern',
        title: `${doc ? markdownH1(read(doc.path)) : dir} — ${entry.path.split('/').pop()}`,
        group: 'patterns',
        origin: 'hand-authored',
        members: [
          { path: entry.path, role: 'entry' },
          ...(doc ? [{ path: doc.path, role: 'doc' }] : []),
          ...scripts.map((script) => ({ path: script.path, role: 'vendored' })),
        ],
        render: renderOf(entry.path),
      });
    }
  }

  /* -- UI kits ----------------------------------------------------------- */
  add({
    id: 'ui_kits/_shared/Primitives',
    entry: 'ui_kits/_shared/Primitives.jsx',
    category: 'support-file',
    title: 'Shared kit primitives',
    group: 'ui_kits',
    origin: 'hand-authored',
    members: [{ path: 'ui_kits/_shared/Primitives.jsx', role: 'entry' }],
  });
  const kitDirs = [...new Set(under('ui_kits').map((file) => file.path.split('/')[1]))]
    .filter((dir) => dir !== '_shared')
    .sort();
  for (const dir of kitDirs) {
    const dirFiles = under(`ui_kits/${dir}`);
    const doc = dirFiles.find((file) => file.path.endsWith('README.md'));
    const sources = dirFiles.filter((file) => file.path.endsWith('.jsx'));
    add({
      id: `ui_kits/${dir}`,
      entry: `ui_kits/${dir}/index.html`,
      category: 'ui-kit',
      title: doc ? markdownH1(read(doc.path)) : dir,
      group: 'ui_kits',
      origin: 'hand-authored',
      components: kitComponents(
        root,
        sources.map((file) => file.path),
      ),
      members: [
        { path: `ui_kits/${dir}/index.html`, role: 'entry' },
        ...(doc ? [{ path: doc.path, role: 'doc' }] : []),
        ...sources.map((file) => ({ path: file.path, role: 'source' })),
      ],
      render: renderOf(`ui_kits/${dir}/index.html`),
    });
  }

  /* -- Uploads: stray working material ----------------------------------- */
  for (const file of under('uploads')) {
    add({
      id: file.path.replace(/\.[a-z]+$/, ''),
      entry: file.path,
      category: 'scratch',
      title: file.path.split('/').pop(),
      group: 'uploads',
      origin: 'incidental',
      members: [{ path: file.path, role: 'entry' }],
    });
  }

  /* -- The Claude Design project mirror. Manifested but expected to shrink
        to zero as kits are ported — nothing may hardcode its counts. Every
        entry point loads _ds_bundle.js (the kits directly, the templates via
        ds-base.js), which was deliberately not copied. ---------------------- */
  const MIRROR_BLOCKED = ['loads _ds_bundle.js, which is deliberately not mirrored'];
  add({
    id: '_project-mirror/README',
    entry: '_project-mirror/README.md',
    category: 'brand-doc',
    title: markdownH1(read('_project-mirror/README.md')) ?? 'Project mirror',
    group: '_project-mirror',
    origin: 'mirrored',
    members: [{ path: '_project-mirror/README.md', role: 'entry' }],
  });
  const mirrorKitDirs = [
    ...new Set(under('_project-mirror/ui_kits').map((file) => file.path.split('/')[2])),
  ].sort();
  for (const dir of mirrorKitDirs) {
    const base = `_project-mirror/ui_kits/${dir}`;
    const dirFiles = under(base);
    const doc = dirFiles.find((file) => file.path.endsWith('README.md'));
    add({
      id: base,
      entry: `${base}/index.html`,
      category: 'ui-kit',
      title: doc ? markdownH1(read(doc.path)) : dir,
      group: '_project-mirror',
      origin: 'mirrored',
      members: [
        { path: `${base}/index.html`, role: 'entry' },
        ...(doc ? [{ path: doc.path, role: 'doc' }] : []),
        ...dirFiles
          .filter((file) => file.path.endsWith('.jsx'))
          .map((file) => ({ path: file.path, role: 'source' })),
      ],
      render: renderOf(`${base}/index.html`, { blockedBy: MIRROR_BLOCKED }),
    });
  }
  const mirrorTemplateDirs = [
    ...new Set(under('_project-mirror/templates').map((file) => file.path.split('/')[2])),
  ].sort();
  for (const dir of mirrorTemplateDirs) {
    const base = `_project-mirror/templates/${dir}`;
    const dirFiles = under(base);
    const entry = dirFiles.find((file) => file.path.endsWith('.dc.html'));
    if (!entry) {
      throw new Error(`brand manifest: ${base} has no .dc.html entry point.`);
    }
    add({
      id: base,
      entry: entry.path,
      category: 'pattern',
      title: entry.path
        .split('/')
        .pop()
        .replace(/\.dc\.html$/, ''),
      group: '_project-mirror',
      origin: 'mirrored',
      members: [
        { path: entry.path, role: 'entry' },
        ...dirFiles
          .filter((file) => file.path.endsWith('ds-base.js'))
          .map((file) => ({ path: file.path, role: 'source' })),
        ...dirFiles
          .filter((file) => file.path.endsWith('support.js'))
          .map((file) => ({ path: file.path, role: 'vendored' })),
      ],
      render: renderOf(entry.path, { blockedBy: MIRROR_BLOCKED }),
    });
  }

  /* -- Nothing on disk may be invisible to the manifest ------------------- */
  const claimed = new Set(artifacts.flatMap((artifact) => artifact.members.map((m) => m.path)));
  const unclaimed = files.filter((file) => !claimed.has(file.path)).map((file) => file.path);
  if (unclaimed.length > 0) {
    throw new Error(
      `brand manifest: ${unclaimed.length} file(s) belong to no artifact — teach ` +
        `brand-manifest.mjs about them:\n${unclaimed.map((path) => `  ${path}`).join('\n')}`,
    );
  }
  const entryPaths = artifacts.map((artifact) => artifact.path);
  if (new Set(entryPaths).size !== entryPaths.length) {
    throw new Error('brand manifest: two artifacts claim the same entry path.');
  }

  return {
    $comment:
      'Generated by packages/ai-patterns/src/artifacts/brand-manifest.mjs — do not edit by hand.',
    root: 'design-system-docs',
    artifacts,
  };
}

/* ------------------------------------------------------------------------- *
 * The in-repo README index table.
 *
 * The table between design-system-docs/README.md's managed markers used to be
 * hand-maintained and drifted: it advertised a `templates/` directory that had
 * been renamed `patterns/`, a fifth slide template that does not exist, and an
 * auth surface the webapp kit does not export — while omitting six top-level
 * entries including `guidelines/`. Everything derivable below derives from the
 * manifest; the editorial descriptions are checked for completeness, so a new
 * top-level entry fails the build until it gets a row.
 * ------------------------------------------------------------------------- */

export function renderRepoIndexTable(manifest) {
  const { artifacts } = manifest;
  const ofCategory = (category) => artifacts.filter((artifact) => artifact.category === category);
  const kit = (id) => artifacts.find((artifact) => artifact.id === id);

  const guidelineCards = ofCategory('guideline-card');
  const componentCards = ofCategory('component-card').length;
  const generatedCards = guidelineCards.filter((card) => card.origin === 'generated').length;
  const slideTemplates = ofCategory('slide')
    .filter((slide) => slide.render?.viewport?.width === 1280)
    .map((slide) =>
      slide.path
        .split('/')
        .pop()
        .replace(/\.html$/, ''),
    );
  const mirrorKits = artifacts.filter(
    (artifact) => artifact.group === '_project-mirror' && artifact.category === 'ui-kit',
  ).length;
  const mirrorTemplates = artifacts.filter(
    (artifact) => artifact.group === '_project-mirror' && artifact.category === 'pattern',
  ).length;
  const kitRow = (id) => {
    const artifact = kit(id);
    /* A kit with no .jsx sources defines its markup inline in the entry. */
    return artifact.components.length > 0
      ? `${artifact.title} — ${artifact.components.join(', ')}.`
      : `${artifact.title}.`;
  };
  const patternRow = (dir) => {
    const first = artifacts.find(
      (artifact) => artifact.group === 'patterns' && artifact.path.startsWith(`patterns/${dir}/`),
    );
    return `${first.title.split(' — ')[0]}.`;
  };

  const tokensArtifact = kit('colors_and_type');
  const tokensNote = tokensArtifact.symlinkTarget
    ? ` Symlink to \`${tokensArtifact.symlinkTarget.replace(/^(\.\.\/)+/, '')}\`.`
    : '';
  const fontsArtifact = kit('fonts');
  const fontsNote = fontsArtifact.symlinkTarget
    ? ` Symlink to \`${fontsArtifact.symlinkTarget.replace(/^(\.\.\/)+/, '')}\`.`
    : '';

  const rows = [
    {
      path: 'colors_and_type.css',
      description: `All brand design tokens — colors, type, spacing, radii, shadow, motion.${tokensNote}`,
    },
    {
      path: 'styles.css',
      description:
        'Generated aggregate the guideline cards link — @imports the real component ' +
        'stylesheets from packages/react. Rebuilt by `pnpm -F @elirobinson/ai-patterns build:design-project`.',
    },
    {
      path: 'fonts.css',
      description:
        '@font-face for Geist and JetBrains Mono, self-hosted — colors_and_type.css ' +
        `@imports it.${fontsNote}`,
    },
    {
      path: 'fonts/',
      description:
        'The woff2 files fonts.css loads, with their SIL OFL licenses. ' +
        'Symlinks into `packages/tokens/src/fonts/`.',
    },
    {
      path: 'assets/',
      description: 'Wordmark, monogram, lockup, dot-grid pattern. SVG-first.',
    },
    {
      path: 'guidelines/',
      description:
        `${generatedCards} token-enumeration cards generated by guideline-cards.mjs ` +
        `plus ${guidelineCards.length - generatedCards} hand-authored editorial cards.`,
    },
    {
      path: 'preview/',
      description:
        'Design System tab cards — type/color/spacing/component swatches. Working material.',
    },
    {
      path: 'components/',
      description:
        `${componentCards} component specimen cards — one per tier group, ` +
        'showing the real `ds-*` markup against the aggregate stylesheet. Working material.',
    },

    { path: 'ui_kits/marketing/', description: kitRow('ui_kits/marketing') },
    { path: 'ui_kits/webapp/', description: kitRow('ui_kits/webapp') },
    { path: 'ui_kits/mobile/', description: kitRow('ui_kits/mobile') },
    { path: 'ui_kits/docs/', description: kitRow('ui_kits/docs') },
    { path: 'ui_kits/_shared/', description: 'Shared JSX primitives every kit loads.' },
    {
      path: 'slides/',
      description: `16:9 deck templates — ${slideTemplates.join(', ')} — plus an index.`,
    },
    { path: 'patterns/email/', description: patternRow('email') },
    { path: 'patterns/invoice/', description: patternRow('invoice') },
    { path: 'patterns/social-carousel/', description: patternRow('social-carousel') },
    {
      path: 'uploads/',
      description: 'Scratch uploads — working material.',
    },
    {
      path: '_project-mirror/',
      description:
        `Claude Design project mirror — ${mirrorKits} UI kits and ${mirrorTemplates} page ` +
        'templates awaiting port. Renders only inside that project (loads `_ds_bundle.js`).',
    },
    {
      path: 'SKILL.md',
      description: 'Agent Skills frontmatter — drop this folder into Claude Code as a skill.',
    },
  ];

  /* A new top-level entry with no row is the drift this table used to have. */
  const covered = new Set(rows.map((row) => row.path.split('/')[0]));
  covered.add('README.md'); // the file this table lives in
  const topLevel = new Set(artifacts.map((artifact) => artifact.path.split('/')[0]));
  const missing = [...topLevel].filter((entry) => !covered.has(entry));
  if (missing.length > 0) {
    throw new Error(
      `renderRepoIndexTable: no row describes ${missing.join(', ')} — add one in ` +
        'brand-manifest.mjs.',
    );
  }
  const stale = [...covered].filter((entry) => entry !== 'README.md' && !topLevel.has(entry));
  if (stale.length > 0) {
    throw new Error(
      `renderRepoIndexTable: rows describe ${stale.join(', ')}, which is not on disk.`,
    );
  }

  const shipped = new Set(
    artifacts.filter((artifact) => artifact.ships).map((artifact) => artifact.path.split('/')[0]),
  );
  const width = Math.max(...rows.map((row) => row.path.length + 2), 4);
  const pad = (text) => text.padEnd(width);
  return [
    `| ${pad('Path')} | Ships | What's there |`,
    `| ${'-'.repeat(width)} | ----- | --- |`,
    ...rows.map((row) => {
      const ships = shipped.has(row.path.replace(/\/$/, '').split('/')[0]) ? '✓' : '—';
      return `| ${pad(`\`${row.path}\``)} | ${ships} | ${row.description} |`;
    }),
  ].join('\n');
}
