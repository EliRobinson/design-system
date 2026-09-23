import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['*.test.mjs', 'agent-hooks/*.test.ts'],
    // The agent-hooks end-to-end tests spawn real git and node subprocesses
    // several times per test. The default 5s timeout is tight enough that it
    // can trip under `nx run-many -t test`'s parallelism, where sibling
    // projects' test suites compete for CPU (seen locally when this ran
    // alongside a cold storybook/docs build).
    testTimeout: 20000,
  },
});
