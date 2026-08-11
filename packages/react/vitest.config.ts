import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.tsx', 'scripts/**/*.test.mjs'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
