/* Where the preflight host's build lives and how it is served. Plain
   constants, for the reason tests/visual/storybook/stories.ts gives:
   playwright.config.ts imports this file and is transpiled to CJS. */

export const PREFLIGHT_HOST_DIR = 'apps/preflight-host/dist';
export const PREFLIGHT_HOST_PORT = 6009;
export const PREFLIGHT_HOST_URL = `http://127.0.0.1:${PREFLIGHT_HOST_PORT}`;

/* Every shot's subject starts with this. It has to be a namespace no docs
   route uses. Playwright's `--grep` searches the whole title, so a pattern
   for a subject of `/dialog` (`/dialog · `) would also select the docs shot
   `/components/dialog · light`. */
export const PREFLIGHT_PREFIX = '/preflight';
