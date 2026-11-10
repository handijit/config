import { defineConfig, mergeConfig } from "vitest/config";

import { library } from "../../../lib/vitest.ts";

export default mergeConfig(
  library({ barrels: ["lib/index.ts", "lib/main.ts", "lib/preload.ts"] }),
  // Only here: the house setup file lives outside this fixture, in the repository's lib/.
  // Installed, it sits in node_modules, which Vite serves anyway.
  defineConfig({ server: { fs: { allow: ["../../.."] } } })
);
