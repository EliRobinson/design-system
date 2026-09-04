import { fileURLToPath } from 'node:url';

import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/* The harness build. Not a published artifact and not part of the package's
   `build` target — `pnpm a11y:elements` builds it into a temp-ish `a11y/dist`
   that .gitignore keeps out of the tree. */
export default defineConfig({
  root: fileURLToPath(new URL('./harness', import.meta.url)),
  plugins: [react(), tailwind()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
});
