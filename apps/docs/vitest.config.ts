import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next compiles JSX itself (tsconfig says "preserve"), so a test that
  // imports a component needs the automatic runtime named here.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
