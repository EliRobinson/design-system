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
const brandCssPath = join(srcDir, '..', '..', '..', 'design-system-docs', 'colors_and_type.css');

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
    expect(css).toMatch(/\.dark\s*\{[\s\S]*--focus-ring:\s*var\(--ink-0\);/);
  });
});
