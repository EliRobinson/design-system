import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Shared by the tests that read stylesheets as text. Both elements.css and the
   files it pulls in quote the selectors and imports being asserted on in their
   comments, so every assertion reads them with comments removed. */
export const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* The docs stylesheet, comments removed. */
export const readSiteCss = () =>
  stripComments(readFileSync(join(process.cwd(), 'src/app/site.css'), 'utf8'));

/* The body of every rule whose selector list names `selector`, joined. Rules in
   a grouped selector (`a, b { }`) count; nested at-rule bodies are read too. */
export function declarations(css: string, selector: string): string {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel.split(',').some((s) => s.trim() === selector))
    .map(([, , body]) => body)
    .join(';');
}

/* One property's value from `declarations`; the last declaration wins. */
export function prop(css: string, selector: string, name: string): string {
  const all = [
    ...declarations(css, selector).matchAll(new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+)`, 'g')),
  ];
  if (!all.length) throw new Error(`${selector} has no ${name}`);
  return all[all.length - 1][1].trim();
}
