/** Every TypeScript file of a repository. */
const TYPESCRIPT_FILES = ["**/*.ts", "**/*.mts", "**/*.cts", "**/*.tsx"];

/** Build and release tooling, and the fixtures an Electron smoke test launches. */
const SCRIPT_FILES = ["**/*.mjs", "**/*.cjs", "**/*.js"];

/** Generated output: a package's build, an app's bundles and installers, coverage reports. */
const GENERATED = [
  "build/**",
  "coverage/**",
  "dist/**",
  "out/**",
  "e2e/out/**",
];

export { GENERATED, SCRIPT_FILES, TYPESCRIPT_FILES };
