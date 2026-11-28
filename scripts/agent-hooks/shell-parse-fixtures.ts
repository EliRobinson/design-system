import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at scripts/agent-hooks/, two levels below the repo root.
// Reads are repo-root-relative, not cwd-relative: nx runs this project's
// `test` target with cwd `scripts/`, and vitest's own root is the directory
// holding its config, so a plain relative path would resolve wrongly.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A repo-root-relative path, made absolute. */
export const atRoot = (path: string) => join(repoRoot, path);

/** The time a hook may take on one of the shapes below, in ms. */
export const TIME_BUDGET_MS = 5000;

/** How long `run` takes, in ms. */
export function msToRun(run: () => unknown) {
  const start = performance.now();
  run();
  return performance.now() - start;
}

/** zsh glob groups that hold the next one in their `e` string, by form (#465). */
export const NESTED_GLOB_FORMS = {
  'e[...]': (inner: string) => `echo *(e[${inner}])`,
  'e{...}': (inner: string) => `echo a(e{${inner}})`,
  'standalone (e[...])': (inner: string) => `ls (e[${inner}])`,
};

type NestedGlobForm = keyof typeof NESTED_GLOB_FORMS;

// Nests `form` until `done` says to stop.
function nest(form: NestedGlobForm, done: (script: string, depth: number) => boolean) {
  let script = 'true';
  for (let depth = 0; !done(script, depth); depth++) script = NESTED_GLOB_FORMS[form](script);
  return script;
}

/** `form` nested `depth` deep. */
export const nestedGlobOf = (form: NestedGlobForm, depth: number) =>
  nest(form, (_, at) => at >= depth);

/** `form` nested about 300 characters deep. */
export const nestedGlob = (form: NestedGlobForm) => nest(form, (script) => script.length >= 300);

/** The forms of NESTED_GLOB_FORMS, for it.each. */
export const NESTED_GLOB_NAMES = Object.keys(NESTED_GLOB_FORMS) as NestedGlobForm[];

/** `ls` and `n` glob groups that never close, each holding a closed one (#465). */
export const unclosedGlobChain = (n: number) => `ls ${'a(b(e:true:)'.repeat(n)}`;

/** `x` and `n` plain groups nested in each other, with no qualifiers. */
export const nestedPlainGroups = (n: number) => `x ${'a('.repeat(n)}${')'.repeat(n)}`;

/** `n` glob groups nested in each other, each with an `e` string running git and a `$(...)` in it. */
export const nestedEGroups = (n: number) => `ls ${'a(e:git status;$('.repeat(n)}x${'))'.repeat(n)}`;

/** `n` glob groups nested in each other, each with an `e` string and a `$(...)` in it. */
export const nestedSubstitutionGlobs = (n: number) =>
  `ls ${'a(e:true:$('.repeat(n)}x${'))'.repeat(n)}`;

/** `cat` and `n` process substitutions nested in each other, with `y` in the innermost (#469). */
export const nestedProcessSubstitutions = (n: number) => `cat ${'<('.repeat(n)}y${')'.repeat(n)}`;

/** `cat` and `n` process substitutions in a row, each running `y` (#469). */
export const processSubstitutionRow = (n: number) => `cat ${'<(y) '.repeat(n)}`;
