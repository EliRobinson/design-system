// tokens.css is imported once, and an app that uses @elirobinson/react imports
// it through react/styles.css, which opens with it.
//
// Importing both puts two full copies of tokens.css in the bundle. Bundlers do
// not drop a stylesheet they have already inlined elsewhere, and the later copy
// wins every equal-specificity tie against whatever CSS sits between the two:
// the design-system docs app painted a hero eyebrow the wrong colour for exactly
// this reason (#251). An app that does not use @elirobinson/react still imports
// tokens.css on its own, and this rule leaves that alone.
//
// One module at a time: an app shell that imports react/styles.css in its
// layout and tokens.css in globals.css escapes this, because seeing that needs
// the whole import graph. The two imports almost always sit side by side, in
// the one file the installation docs used to tell people to write.

export const TOKENS_CSS = '@elirobinson/tokens/tokens.css';
export const REACT_STYLES = '@elirobinson/react/styles.css';

const meta = {
  type: 'problem',
  docs: {
    description:
      'Disallow importing @elirobinson/tokens/tokens.css next to @elirobinson/react/styles.css, which already imports it; both together bundle tokens.css twice.',
  },
  schema: [],
  messages: {
    twice: `${REACT_STYLES} already imports ${TOKENS_CSS}. Importing both bundles tokens.css twice. Remove this import.`,
  },
};

/**
 * Report the tokens.css import when the same module also imports
 * react/styles.css.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {Array<{ node: unknown, specifier: string }>} imports
 */
function reportTwice(context, imports) {
  if (!imports.some(({ specifier }) => specifier === REACT_STYLES)) return;
  for (const { node, specifier } of imports) {
    if (specifier === TOKENS_CSS) context.report({ node, messageId: 'twice' });
  }
}

/** For JS and TS modules: `import '…css'`. */
export const jsRule = {
  meta,
  create(context) {
    const imports = [];
    return {
      ImportDeclaration(node) {
        imports.push({ node, specifier: String(node.source.value) });
      },
      'Program:exit'() {
        reportTwice(context, imports);
      },
    };
  },
};

/** For stylesheets: `@import '…';`, with or without `url()` or a layer. */
export const cssRule = {
  meta,
  create(context) {
    const { sourceCode } = context;
    const imports = [];
    return {
      Atrule(node) {
        if (String(node.name).toLowerCase() !== 'import' || !node.prelude) return;
        const specifier = sourceCode.getText(node.prelude).match(/['"]([^'"]+)['"]/)?.[1];
        if (specifier) imports.push({ node, specifier });
      },
      'StyleSheet:exit'() {
        reportTwice(context, imports);
      },
    };
  },
};
