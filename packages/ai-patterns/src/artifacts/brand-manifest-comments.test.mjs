/* The scanners in brand-manifest.mjs read raw stylesheet TEXT, so anything
 * that looks like an `@import` or a `url()` counts — including text inside a
 * CSS comment, which is not a fetch and not a dependency (#120).
 *
 * Both failure modes are covered because they fail in opposite directions and
 * only one of them is loud:
 *
 *   - a local @import in prose throws, and the message names the symlink it
 *     was reached through rather than the file the comment was written in, in
 *     a DIFFERENT package's build;
 *   - an https:// URL in prose is recorded as a real externalOrigin with a
 *     green build, so the shipped manifest asserts a network dependency the
 *     stylesheet does not have. `tokens.css` guarantees the opposite in its
 *     own webfonts comment ("No request leaves the page"), and externalOrigins
 *     is the field someone would read to check that.
 *
 * Fixtures are written to a temp dir rather than the real tree: the point is
 * the scanner's treatment of comments, and the real design-system-docs/ has no
 * commented import to assert against (deliberately — the workaround for this
 * bug is what keeps it that way).
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { originScanner } from './brand-manifest.mjs';

const root = mkdtempSync(join(tmpdir(), 'brand-manifest-comments-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/* The scanner reaches CSS through an HTML entry's <link>, so each case needs a
   stylesheet on disk and a card that links it. */
function scanCardLinking(cssName, css) {
  writeFileSync(join(root, cssName), css);
  const entry = `card-${cssName}.html`;
  const contents = `<link rel="stylesheet" href="./${cssName}">`;
  writeFileSync(join(root, entry), contents);
  return originScanner()(root, entry, contents);
}

describe('brand manifest comment handling (#120)', () => {
  it('does not follow a local @import that only appears inside a comment', () => {
    expect(() =>
      scanCardLinking(
        'commented-import.css',
        `/* Example for docs: a sibling is pulled in with @import './example.css'; */\n` +
          ':root { --x: 1; }\n',
      ),
    ).not.toThrow();
  });

  it('does not record an external origin that only appears inside a comment', () => {
    const origins = scanCardLinking(
      'commented-url.css',
      `/* Before self-hosting we loaded these from url(https://fonts.googleapis.com/css2) — no longer. */\n` +
        ':root { --y: 2; }\n',
    );

    expect(origins).toEqual([]);
  });

  /* The guard on the guard. Masking comments must not blind the scanner to the
     real thing, or #120's fix would quietly undo the dangling-@import error
     that exists because the palette split once shipped a greyscale skill. */
  it('still throws on a real dangling @import outside a comment', () => {
    expect(() =>
      scanCardLinking('real-dangling.css', `@import './missing.css';\n:root { --z: 3; }\n`),
    ).toThrow(/not on disk/);
  });

  it('still records a real external origin outside a comment', () => {
    const origins = scanCardLinking(
      'real-origin.css',
      `@import 'https://fonts.googleapis.com/css2?family=Geist';\n`,
    );

    expect(origins).toEqual(['fonts.googleapis.com']);
  });
});
