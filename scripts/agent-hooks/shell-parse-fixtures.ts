/**
 * zsh glob groups nested about 300 characters deep, each holding the next in
 * its `e` string, by form (#465).
 */
export const NESTED_GLOB_FORMS = {
  'e[...]': (inner: string) => `echo *(e[${inner}])`,
  'e{...}': (inner: string) => `echo a(e{${inner}})`,
  'standalone (e[...])': (inner: string) => `ls (e[${inner}])`,
};

/** `form` nested `depth` deep. @param form one of NESTED_GLOB_FORMS */
export function nestedGlobOf(form: keyof typeof NESTED_GLOB_FORMS, depth: number) {
  let script = 'true';
  for (let i = 0; i < depth; i++) script = NESTED_GLOB_FORMS[form](script);
  return script;
}

/** `form` nested about 300 characters deep. @param form one of NESTED_GLOB_FORMS */
export function nestedGlob(form: keyof typeof NESTED_GLOB_FORMS) {
  let script = 'true';
  while (script.length < 300) script = NESTED_GLOB_FORMS[form](script);
  return script;
}

/** The forms of NESTED_GLOB_FORMS, for it.each. */
export const NESTED_GLOB_NAMES = Object.keys(NESTED_GLOB_FORMS) as Array<
  keyof typeof NESTED_GLOB_FORMS
>;

/** `ls` and `n` glob groups that never close, each holding a closed one (#465). */
export const unclosedGlobChain = (n: number) => `ls ${'a(b(e:true:)'.repeat(n)}`;
