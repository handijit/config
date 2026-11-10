import { defineConfig, mergeConfig } from 'vitest/config';

import { app } from '../../../lib/vitest.ts';

export default mergeConfig(
  app({
    rootDir: import.meta.dirname,
    // Measured 36 / 40 / 100 / 41: the hook waits for an end-to-end test.
    thresholds: { lines: 35, functions: 40, branches: 100, statements: 40 },
  }),
  // Only here: the house setup file lives outside this fixture, in the repository's lib/.
  defineConfig({ server: { fs: { allow: ['../../..'] } } }),
);
