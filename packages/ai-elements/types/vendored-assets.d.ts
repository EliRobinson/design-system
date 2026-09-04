/**
 * Ambient declarations the vendored tree needs and upstream gets from its own
 * app config. Deliberately outside `src/`: everything under `src/` is generated
 * by `pnpm sync:elements`, which deletes any file there that upstream does not
 * have. A declaration file added beside the vendored source would survive
 * exactly until the next re-sync.
 *
 * `.d.ts` files emit nothing, so this sits outside `rootDir` without affecting
 * the shape of `dist/`.
 */

/**
 * `src/components/canvas.tsx` carries a side-effect import of
 * `@xyflow/react/dist/style.css`. A bundler resolves it; tsc has no notion of a
 * CSS module, so it needs telling that one exists and exports nothing.
 */
declare module '*.css';
