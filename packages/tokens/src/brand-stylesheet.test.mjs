/* design-system-docs/colors_and_type.css and this package's tokens.css were two
   hand-kept copies of the same stylesheet, and they had drifted: the brand copy
   was missing the `.dark` compatibility selector and the dark-mode --focus-ring
   override, which is the copy `@elirobinson/ai-patterns` ships into every
   consumer's .claude/skills/miltinson-design/. It is a symlink now, so on a
   normal checkout there is only one file.

   The symlink is what prevents the drift; this is what notices if it stops
   being one — replaced by hand, or materialized as a one-line text file by a
   `core.symlinks=false` checkout, which `cpSync` would happily ship as CSS. */

import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = dirname(fileURLToPath(import.meta.url));
const brandDir = join(srcDir, '..', '..', '..', 'design-system-docs');
const brandCssPath = join(brandDir, 'colors_and_type.css');

/* What the brand copy needs beside it. tokens.css @imports both with relative
   specifiers, and an @import resolves next to the file that contains it — so
   these are the names design-system-docs/ must carry, not the names in this
   package's src/. `colors_and_type.css` is the one rename the brand copy has;
   the siblings keep their real names precisely so the imports still resolve. */
const IMPORTED_SIBLINGS = ['palettes.css', 'mobile.css', 'fonts.css'];

describe('design-system-docs/colors_and_type.css', () => {
  it('is a symlink, not a second copy of the stylesheet', () => {
    expect(lstatSync(brandCssPath).isSymbolicLink()).toBe(true);
  });

  it('resolves to this package’s tokens.css', () => {
    expect(readFileSync(brandCssPath, 'utf8')).toBe(
      readFileSync(join(srcDir, 'tokens.css'), 'utf8'),
    );
  });

  it('therefore carries the dark-mode fixes the brand copy used to be missing', () => {
    const css = readFileSync(brandCssPath, 'utf8');
    expect(css).toContain('.dark {');
  });

  it('reaches the dark --focus-ring override through the stylesheet it @imports', () => {
    /* The override itself moved. It used to sit in tokens.css's own dark block,
       where a regex over the brand copy could see it; the palette split gave
       --focus-ring to palettes.css, so the dark value is declared there now —
       once per theme-dark block, one per palette.

       The guarantee is unchanged and so is what breaks it: a brand copy whose
       dark mode has no focus ring. It now takes two facts instead of one, and
       both are asserted, because either alone would pass while dark focus was
       broken. tokens.css must still @import palettes.css — that import is the
       only reason the symlinked brand copy sees the file at all — and
       palettes.css must still declare --focus-ring inside a dark block.

       Which makes the sibling files load-bearing for the brand copy — see the
       block below. */
    const brandCss = readFileSync(brandCssPath, 'utf8');
    expect(brandCss).toMatch(/@import\s+'\.\/palettes\.css';/);

    const palettesCss = readFileSync(join(srcDir, 'palettes.css'), 'utf8');
    expect(palettesCss).toMatch(/\.dark\s*\{[\s\S]*?--focus-ring:\s*var\(--ink-0\);/);
  });

  /* The failure this closes is the quietest one in the change. `cpSync` with
     `dereference: true` ships colors_and_type.css into every consumer's
     .claude/skills/miltinson-design/, and it ships exactly the files
     BRAND_SOURCES names. Miss a sibling and nothing errors anywhere: the copy
     is present, it parses, its @import 404s, and the shipped brand skill
     renders in greyscale with no brand and no status colour in it. */
  for (const sibling of IMPORTED_SIBLINGS) {
    it(`has ${sibling} beside it, symlinked, so the @import resolves`, () => {
      const path = join(brandDir, sibling);
      expect(lstatSync(path).isSymbolicLink()).toBe(true);
      expect(readFileSync(path, 'utf8')).toBe(readFileSync(join(srcDir, sibling), 'utf8'));
    });
  }

  it('imports every sibling it carries, and carries every sibling it imports', () => {
    /* Both directions. A file in design-system-docs/ that nothing imports is
       dead weight the brand skill still ships; an import with no file is the
       greyscale bug above. */
    const imported = [
      ...readFileSync(brandCssPath, 'utf8').matchAll(/@import\s+(?:url\()?'\.\/([\w.-]+)'/g),
    ].map((match) => match[1]);
    expect(imported.sort()).toEqual([...IMPORTED_SIBLINGS].sort());
  });
});
