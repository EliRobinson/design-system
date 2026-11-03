/* components/bundle.js for the Claude "Design System" artifact.
 *
 * One classic script: an IIFE that assigns window.<NAMESPACE> and reads React
 * from window.React and window.ReactDOM (the artifact loads React 18.3.1 from
 * components/lib/ first). Built from @elirobinson/react's dist, in manifest
 * order, plus ChatComposer and PromptSuggestions, which exist only in the
 * artifact and are built from its components/src/components/ai/*.jsx.
 *
 * Line 1 is the header the artifact reads for the namespace and the
 * component order.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'esbuild';

/* Existing previews, kits and templates call this name. Never change it. */
export const NAMESPACE = 'MiltinsonDesignSystem_e160cb';
export const ARTIFACT_ONLY_COMPONENTS = ['ChatComposer', 'PromptSuggestions'];
/* The artifact-only components sit after this one in the bundle order. */
const ARTIFACT_ONLY_AFTER = 'StreamingCaret';

/* react/jsx-runtime over createElement, so the bundle needs nothing but window.React. */
const JSX_SHIM = `
var R = window.React;
function mk(type, props, key, spread) {
  var p = {}, c, k;
  for (k in props) if (k !== 'children') p[k] = props[k];
  if (key !== undefined) p.key = '' + key;
  c = props ? props.children : undefined;
  if (c === undefined) return R.createElement(type, p);
  if (spread && Array.isArray(c)) return R.createElement.apply(null, [type, p].concat(c));
  p.children = c;
  return R.createElement(type, p);
}
export var Fragment = R.Fragment;
export function jsx(t, p, k) { return mk(t, p, k, false); }
export function jsxs(t, p, k) { return mk(t, p, k, true); }
export var jsxDEV = jsx;
`;

const reactGlobals = {
  name: 'react-globals',
  setup(builder) {
    builder.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => ({
      path: args.path,
      namespace: 'react-globals',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'react-globals' }, (args) => {
      if (args.path === 'react')
        return { contents: 'module.exports = window.React;', loader: 'js' };
      if (args.path === 'react-dom' || args.path === 'react-dom/client') {
        return { contents: 'module.exports = window.ReactDOM;', loader: 'js' };
      }
      if (args.path === 'react/jsx-runtime' || args.path === 'react/jsx-dev-runtime') {
        return { contents: JSX_SHIM, loader: 'js' };
      }
      throw new Error(`bundle.js: no global for ${args.path}`);
    });
  },
};

/** The bundle's components in order, each with its exports and its source file. */
export function bundleComponents({ manifest, reactDist, previousDir }) {
  const components = [];
  for (const component of manifest.components) {
    components.push({
      name: component.name,
      exports: component.exports,
      file: join(reactDist, 'components', `${component.subpath}.js`),
      sourcePath: `components/${component.subpath}.tsx`,
    });
    if (component.name === ARTIFACT_ONLY_AFTER) {
      for (const name of ARTIFACT_ONLY_COMPONENTS) {
        components.push({
          name,
          exports: [name],
          file: join(previousDir, 'components/src/components/ai', `${name}.jsx`),
          sourcePath: `components/ai/${name}.jsx`,
        });
      }
    }
  }
  if (!components.some((component) => component.name === ARTIFACT_ONLY_COMPONENTS[0])) {
    throw new Error(
      `the manifest has no ${ARTIFACT_ONLY_AFTER}; place the artifact-only components`,
    );
  }
  const seen = new Set();
  for (const component of components) {
    if (!existsSync(component.file)) throw new Error(`bundle.js: missing ${component.file}`);
    for (const name of component.exports) {
      if (seen.has(name)) throw new Error(`bundle.js: ${name} is exported twice`);
      seen.add(name);
    }
  }
  return components;
}

export function bundleHeader(components) {
  return `/* @ds-bundle: ${JSON.stringify({
    format: 4,
    namespace: NAMESPACE,
    components: components.map(({ name, sourcePath }) => ({ name, sourcePath })),
  })} */`;
}

/** Parses line 1 of a bundle.js back into its header, or null. */
export function readBundleHeader(js) {
  const match = /^\/\* @ds-bundle: (.*) \*\/$/.exec(js.split('\n', 1)[0]);
  return match ? JSON.parse(match[1]) : null;
}

export async function buildBundleJs({ manifest, reactDist, previousDir }) {
  const components = bundleComponents({ manifest, reactDist, previousDir });
  const entry = components
    .map(({ exports, file }) => `export { ${exports.join(', ')} } from ${JSON.stringify(file)};\n`)
    .join('');
  const result = await build({
    stdin: { contents: entry, resolveDir: reactDist, sourcefile: 'entry.js', loader: 'js' },
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: NAMESPACE,
    platform: 'browser',
    target: 'es2019',
    jsx: 'automatic',
    loader: { '.jsx': 'jsx' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [reactGlobals],
    write: false,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'warning',
  });
  let js = result.outputFiles[0].text;
  /* esbuild writes `var NS=(()=>{…})();`. A classic script inlined by the
     artifact must set the global explicitly. */
  js = js.replace(new RegExp(`^var ${NAMESPACE}=`), `window.${NAMESPACE}=`);
  if (!js.startsWith(`window.${NAMESPACE}=`)) {
    throw new Error(`bundle.js: unexpected prelude ${js.slice(0, 80)}`);
  }
  /* The artifact inlines this file in a <script> element. */
  js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return { js: `${bundleHeader(components)}\n${js}`, components };
}
