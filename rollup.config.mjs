import { isAbsolute } from "node:path";

import typescript from "@rollup/plugin-typescript";
import { dts } from "rollup-plugin-dts";

// One bundle per entry. The ESLint entry must not pull in Vitest, and the Vitest entry must not
// pull in ESLint: a consumer that uses one tool never installs the others.
const ENTRIES = [
  "eslint",
  "prettier",
  "prettier-app",
  "vitest",
  "vitest-setup",
  "dependency-cruiser",
];

// Every package import stays an import: the tools are peers, the ESLint plugins dependencies.
const external = (id) => !id.startsWith(".") && !isAbsolute(id);

export default ENTRIES.flatMap((entry) => [
  {
    input: `./lib/${entry}.ts`,
    external,
    output: { file: `./build/${entry}.mjs`, format: "es", sourcemap: true },
    plugins: [typescript({ tsconfig: "./tsconfig.json" })],
  },
  {
    input: `./lib/${entry}.ts`,
    external,
    output: { file: `./build/${entry}.d.mts`, format: "es" },
    plugins: [dts({ tsconfig: "./tsconfig.json" })],
  },
]);
