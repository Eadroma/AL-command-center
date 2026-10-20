import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Bundle compilation is CPU-heavy. A bounded pool also matches small CI runners.
    maxWorkers: 2,
    testTimeout: 15000,
    hookTimeout: 15000,
    setupFiles: ['./tests/setup.ts'],
  },
});
