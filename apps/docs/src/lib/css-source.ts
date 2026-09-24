/* Shared by the tests that read stylesheets as text. Both elements.css and the
   files it pulls in quote the selectors and imports being asserted on in their
   comments, so every assertion reads them with comments removed. */
export const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
