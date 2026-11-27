import { isAbsolute } from "node:path";

import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

// One build per entry, no shared chunks: each published file stands alone. `vitest.mjs` finds
// `vitest-setup.mjs` next to it at run time.
const ENTRIES = {
  eslint: "./lib/eslint.ts",
  prettier: "./lib/prettier.ts",
  "prettier-app": "./lib/prettier-app.ts",
  vitest: "./lib/vitest.ts",
  "vitest-setup": "./lib/vitest-setup.ts",
  "dependency-cruiser": "./lib/dependency-cruiser.ts",
};

// Every bare import (the plugins this package depends on, its peers, `node:*`) stays an import.
const external = (id) =>
  !id.startsWith(".") && !id.startsWith("\0") && !isAbsolute(id);

export default Object.entries(ENTRIES).flatMap(([name, input]) => [
  {
    input,
    external,
    output: {
      file: `./build/${name}.mjs`,
      format: "es",
      sourcemap: true,
    },
    // TypeScript alone compiles to the tsconfig target; no Babel anywhere.
    plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  },
  {
    // ESM only (section 7): one declaration file per entry, as `.d.mts`.
    input,
    external,
    output: { file: `./build/${name}.d.mts`, format: "es" },
    plugins: [dts({ tsconfig: "./tsconfig.json" })],
  },
]);
