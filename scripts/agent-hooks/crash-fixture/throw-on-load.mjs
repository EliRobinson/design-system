// @ts-check
// Test fixture, never wired into a hook. `node --import <this file> <hook>`
// runs a hook whose rules throw while they load, so the tests can check what
// the hook does when it crashes there (#479). See hooks.mjs.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url, { data: { mode: 'load' } });
