import { describe, expect, it } from 'vitest';

import { cssImports, cssUrls, flatten, importsAfterFirstRule } from './css.mjs';
import { expandExports, resolveExport, specifierFor } from './exports.mjs';

describe('expandExports', () => {
  const files = [
    './dist/components/atoms/Button.js',
    './dist/components/atoms/Button.d.ts',
    './dist/components/lib.css',
    './dist/artifacts/skills/a/kit.js',
  ];

  it('expands a pattern against the files in the tarball, nested paths included', () => {
    const expanded = expandExports(
      {
        './components/*': {
          types: './dist/components/*.d.ts',
          import: './dist/components/*.js',
        },
      },
      files,
    );

    expect(expanded.map((entry) => entry.subpath)).toEqual(['./components/atoms/Button']);
    expect(expanded[0].leaves).toEqual([
      { conditions: ['types'], file: './dist/components/atoms/Button.d.ts' },
      { conditions: ['import'], file: './dist/components/atoms/Button.js' },
    ]);
    expect(expanded[0].passthrough).toBe(false);
  });

  it('marks a pattern whose target ends in the star as a passthrough', () => {
    const [entry] = expandExports({ './artifacts/*': './dist/artifacts/*' }, files);

    expect(entry).toMatchObject({ subpath: './artifacts/skills/a/kit.js', passthrough: true });
  });

  it('keeps exact keys and unfolds the sugar forms', () => {
    expect(expandExports('./index.js', files)[0].subpath).toBe('.');
    expect(expandExports({ import: './a.js' }, files)[0].subpath).toBe('.');
    expect(expandExports({ './x': null }, files)).toEqual([]);
  });

  it('writes the specifier a consumer types', () => {
    expect(specifierFor('@s/p', '.')).toBe('@s/p');
    expect(specifierFor('@s/p', './a/b')).toBe('@s/p/a/b');
  });
});

describe('resolveExport', () => {
  const tailwind = { '.': { style: './index.css', import: './dist/lib.mjs' } };

  it('follows the style condition a CSS bundler uses', () => {
    expect(resolveExport(tailwind, '.', ['style'])).toBe('./index.css');
  });

  it('picks the longest pattern prefix', () => {
    const map = { './*': './a/*', './styles/*.css': './src/*.css' };
    expect(resolveExport(map, './styles/x.css', [])).toBe('./src/x.css');
  });

  it('returns null for a subpath that is not exported', () => {
    expect(resolveExport({ './a': './a.css' }, './b', [])).toBeNull();
  });
});

describe('css', () => {
  it('reads both @import forms and ignores commented ones', () => {
    const css = "/* @import 'no'; */\n@import './a.css' layer(x);\n@import url(\"./b.css\");";

    expect(cssImports(css).map(({ specifier, form }) => [specifier, form])).toEqual([
      ['./a.css', 'string'],
      ['./b.css', 'url'],
    ]);
  });

  it('reads url() references outside @import', () => {
    const css = "@import url('./x.css');\n@font-face { src: url(./f.woff2) format('woff2'); }";

    expect(cssUrls(css)).toEqual(['./f.woff2']);
  });

  it('finds an @import that follows a rule', () => {
    expect(importsAfterFirstRule("a { b: c }\n@import './x.css';")).toHaveLength(1);
    expect(importsAfterFirstRule("@layer base;\n@import './x.css';\na { b: c }")).toEqual([]);
  });

  /* #76 in miniature: the string form is inlined, the url() form is not, so
     the url() import ends up behind the rules of the file inlined before it. */
  it('inlines string imports and strands url() imports, as Lightning CSS does', () => {
    const sheets = {
      tailwindcss: '.utility { color: red }',
      tokens: "@import url('./fonts.css');\n:root { --a: 1 }",
      fixed: "@import './fonts.css';\n:root { --a: 1 }",
      './fonts.css': '@font-face { font-family: X }',
    };
    const load = (specifier) =>
      sheets[specifier] ? { file: specifier, css: sheets[specifier] } : null;

    const broken = flatten("@import 'tailwindcss';\n@import 'tokens';", load);
    const fixed = flatten("@import 'tailwindcss';\n@import 'fixed';", load);

    expect(importsAfterFirstRule(broken).map((entry) => entry.specifier)).toEqual(['./fonts.css']);
    expect(importsAfterFirstRule(fixed)).toEqual([]);
    expect(fixed).toContain('@font-face');
  });
});
