import { fileURLToPath } from 'node:url';

import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/* A consumer's build: Vite, React and Tailwind's own Vite plugin, nothing
   else. The visual suite serves dist/ with scripts/serve-static.mjs. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwind()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
  },
});
