// @ts-check
// Test fixture, never wired into a hook. `node --import <this file> <hook>`
// runs a hook with shell-parse functions that throw when called, so the
// tests can check what the hook does when it crashes (#479). See hooks.mjs.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url, { data: { mode: 'parse' } });
