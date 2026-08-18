/* Where this repo's Storybook build lives and how it is served. The
   enumeration itself is `storybookStories` from
   `@elirobinson/ai-patterns/testing/visual-sweep` — a consumer gets the same
   sweep by pointing it at their own build, and only these three values differ.

   Plain constants, because playwright.config.ts imports this and is transpiled
   to CJS (the root package.json has no "type": "module"), where import.meta is
   a syntax error. Every entry point is a pnpm script, and pnpm runs those from
   the package directory, so the relative path below resolves against the repo
   root. */

export const STORYBOOK_DIR = 'apps/storybook/storybook-static';
export const STORYBOOK_PORT = 6007;
export const STORYBOOK_URL = `http://127.0.0.1:${STORYBOOK_PORT}`;

/** Named in the error when the build is missing. */
export const BUILD_HINT = '`pnpm test:visual` does this for you';
