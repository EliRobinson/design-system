import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next, which would leave JSX untouched
  // here. The tests need it compiled.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
