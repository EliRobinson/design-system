import { codeToHtml } from 'shiki';

import { miltinsonLight } from './shiki-theme';

export async function highlight(code: string, lang: string): Promise<string> {
  return codeToHtml(code, { lang, theme: miltinsonLight });
}
