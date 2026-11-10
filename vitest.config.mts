import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import { library } from "./lib/vitest.ts";

// The repository tests itself with its own preset, loaded from the source. The fixture
// projects run ESLint, tsc, Vitest and dependency-cruiser, which takes longer than a unit test.
export default mergeConfig(
  library({ barrels: ["lib/eslint.ts"] }),
  defineConfig({
    test: {
      testTimeout: 60_000,
      hookTimeout: 60_000,
      exclude: [...configDefaults.exclude, "__tests__/fixtures/**"],
    },
  })
);
