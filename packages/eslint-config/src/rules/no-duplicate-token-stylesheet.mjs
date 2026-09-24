// Enforces @elirobinson/ai-patterns contracts.json → token-stylesheet-once;
// that entry says why a second copy of tokens.css matters.
//
// What this rule sees: one file at a time, and static imports only
// (`import '…'` in a module, `@import` in a stylesheet). An app shell that
// imports react/styles.css in its layout and tokens.css in globals.css escapes
// it, and so does a `require()` or a dynamic `import()`. The two imports almost
// always sit side by side, in the one file the installation docs used to tell
// people to write.

const TOKENS_CSS = '@elirobinson/tokens/tokens.css';
const REACT_STYLES = '@elirobinson/react/styles.css';

const meta = {
  type: 'problem',
  docs: {
    description:
      'Disallow importing @elirobinson/tokens/tokens.css next to @elirobinson/react/styles.css, which already imports it; both together bundle tokens.css twice.',
  },
  schema: [],
  messages: {
    twice: `${REACT_STYLES} already imports ${TOKENS_CSS}. Importing both bundles tokens.css twice. Remove this import.`,
    repeated:
      '{{specifier}} is already imported in this file. A second import bundles it twice. Remove this one.',
  },
};

/**
 * Report the tokens.css import when the same file also imports
 * react/styles.css, and any second import of either one.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {Array<{ node: unknown, specifier: string }>} imports
 */
function reportTwice(context, imports) {
  const withReact = imports.some(({ specifier }) => specifier === REACT_STYLES);
  const seen = new Set();
  for (const { node, specifier } of imports) {
    if (specifier !== TOKENS_CSS && specifier !== REACT_STYLES) continue;
    if (seen.has(specifier)) {
      context.report({ node, messageId: 'repeated', data: { specifier } });
    } else if (specifier === TOKENS_CSS && withReact) {
      context.report({ node, messageId: 'twice' });
    }
    seen.add(specifier);
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
        /* `'x'`, `"x"`, `url('x')` or an unquoted `url(x)`, then any
           layer(), supports() or media query. */
        const specifier = sourceCode
          .getText(node.prelude)
          .match(/^\s*(?:url\(\s*)?['"]?([^'")\s]+)/i)?.[1];
        if (specifier) imports.push({ node, specifier });
      },
      'StyleSheet:exit'() {
        reportTwice(context, imports);
      },
    };
  },
};
