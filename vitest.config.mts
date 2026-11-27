import { mergeConfig } from "vitest/config";

import { library } from "./lib/vitest.ts";

// The repository tests itself with its own library preset. The entry barrels hold no logic; the
// public surface test measures them.
export default mergeConfig(
  library({ barrels: ["lib/eslint.ts", "lib/prettier-app.ts"] }),
  {
    test: {
      // The ESLint and dependency-cruiser runs build real programs; give them room on a cold CI.
      testTimeout: 30_000,
    },
  }
);
