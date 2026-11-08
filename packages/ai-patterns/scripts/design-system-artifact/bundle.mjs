/* components/bundle.js for the Claude "Design System" artifact.
 *
 * One classic script: an IIFE that assigns window.<NAMESPACE> and reads React
 * from window.React and window.ReactDOM (the artifact loads React 18.3.1 from
 * components/lib/ first). Built from @elirobinson/react's dist, in manifest
 * order, plus the artifact-only components (artifact-only.mjs), built from
 * their sources in the artifact.
 *
 * Line 1 is the header the artifact reads for the namespace and the
 * component order.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'esbuild';

import { ARTIFACT_ONLY, inArtifactOrder } from './artifact-only.mjs';

/* Existing previews, kits and templates call this name. Never change it. */
export const NAMESPACE = 'MiltinsonDesignSystem_e160cb';

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

/** One published component, with its exports and its source file. */
function published(reactDist) {
  return (component) => ({
    name: component.name,
    exports: component.exports,
    file: join(reactDist, 'components', `${component.subpath}.js`),
    sourcePath: `components/${component.subpath}.tsx`,
  });
}

/** What @elirobinson/react publishes, in manifest order. The UI kits' bundle holds these. */
export function publishedComponents({ manifest, reactDist }) {
  return checked(manifest.components.map(published(reactDist)));
}

/** The artifact's components: the published ones with the artifact-only ones in place. */
export function bundleComponents({ manifest, reactDist, previousDir }) {
  return checked(
    inArtifactOrder(manifest.components, published(reactDist), (name) => ({
      name,
      exports: [name],
      file: join(previousDir, ARTIFACT_ONLY.source(name)),
      /* The header names a source relative to components/src/, as the published ones do. */
      sourcePath: ARTIFACT_ONLY.source(name).replace(/^components\/src\//, ''),
    })),
  );
}

/** Throws if a component's file is missing or two components export one name. */
function checked(components) {
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

export function bundleHeader(components, namespace = NAMESPACE) {
  return `/* @ds-bundle: ${JSON.stringify({
    format: 4,
    namespace,
    components: components.map(({ name, sourcePath }) => ({ name, sourcePath })),
  })} */`;
}

/** Parses line 1 of a bundle.js back into its header, or null. */
export function readBundleHeader(js) {
  const match = /^\/\* @ds-bundle: (.*) \*\/$/.exec(js.split('\n', 1)[0]);
  return match ? JSON.parse(match[1]) : null;
}

/**
 * The artifact's bundle, from `bundleComponents`, unless `components` names others.
 * `namespace` is the global it assigns: the artifact's keeps NAMESPACE, and the UI
 * kits' bundle (scripts/kit-bundle.mjs) passes the published components and its own.
 */
export async function buildBundleJs({
  manifest,
  reactDist,
  previousDir,
  components = bundleComponents({ manifest, reactDist, previousDir }),
  namespace = NAMESPACE,
}) {
  const entry = components
    .map(({ exports, file }) => `export { ${exports.join(', ')} } from ${JSON.stringify(file)};\n`)
    .join('');
  const result = await build({
    stdin: { contents: entry, resolveDir: reactDist, sourcefile: 'entry.js', loader: 'js' },
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: namespace,
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
  js = js.replace(new RegExp(`^var ${namespace}=`), `window.${namespace}=`);
  if (!js.startsWith(`window.${namespace}=`)) {
    throw new Error(`bundle.js: unexpected prelude ${js.slice(0, 80)}`);
  }
  /* The artifact inlines this file in a <script> element. */
  js = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return { js: `${bundleHeader(components, namespace)}\n${js}`, components };
}
