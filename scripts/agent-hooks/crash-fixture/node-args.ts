import { fileURLToPath } from 'node:url';

// Node arguments that load a hook with its rules made to throw. See hooks.mjs.
const importing = (file: string) => [
  '--import',
  fileURLToPath(new URL(`./${file}`, import.meta.url)),
];

/** Shell-parse functions throw when they are called. */
export const CRASH_ON_PARSE = importing('throw-on-parse.mjs');
/** The rules throw while they load. */
export const CRASH_ON_LOAD = importing('throw-on-load.mjs');
