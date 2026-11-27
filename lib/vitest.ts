import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ViteUserConfig } from "vitest/config";

// The setup files sit next to this module: `.mjs` once built, `.ts` in the source.
const sibling = (name: string): string =>
  fileURLToPath(
    new URL(`./${name}${extname(import.meta.url)}`, import.meta.url)
  );
const SETUP = sibling("vitest-setup");
const COVERAGE_GUARD = sibling("vitest-coverage");

/** Coverage percentages below which `vitest run --coverage` fails. */
type Thresholds = {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
};

/** Options of the `library` preset. */
type LibraryOptions = {
  /** The source directory. Default `lib`. */
  source?: string;
  /** The test directory. Default `__tests__`. */
  tests?: string;
  /**
   * Files without behaviour of their own, left out of coverage: the barrels (measured by an
   * index test) and the type-only files. Default `lib/index.ts` and `lib/types/**`.
   */
  barrels?: string[];
  /** Setup files run after the house one. */
  setupFiles?: string[];
};

/** Options of the `app` preset. */
type AppOptions = {
  /**
   * The measured coverage, rounded down a little. Required: an app's gate sits slightly below
   * the value it reached and is never lowered (ELECTRON_APP.md section 16).
   */
  thresholds: Thresholds;
  /** The directory the aliases are relative to: pass `import.meta.dirname`. */
  rootDir: string;
  /** The unit-test directory. Default `tests/unit`. */
  tests?: string;
  /**
   * The pure-logic layers coverage measures. Default: shared, main's services, the renderer's
   * hooks, helpers and store. Components are left to the end-to-end tests.
   */
  coverage?: string[];
  /** Setup files run after the house one. */
  setupFiles?: string[];
};

/**
 * What every suite shares: tests in node, `*.dom.test.*` in jsdom; mocks, stubbed globals and
 * environment variables reset between tests, so no test sees another's leftovers; and a run
 * with coverage fails when the coverage include matches no file.
 */
const common = (
  tests: string,
  setupFiles: string[]
): NonNullable<ViteUserConfig["test"]> => ({
  projects: [
    {
      extends: true,
      test: {
        name: "node",
        environment: "node",
        include: [`${tests}/**/*.test.ts`],
        exclude: [`${tests}/**/*.dom.test.ts`],
      },
    },
    {
      extends: true,
      test: {
        name: "jsdom",
        environment: "jsdom",
        include: [`${tests}/**/*.dom.test.{ts,tsx}`],
      },
    },
  ],
  clearMocks: true,
  restoreMocks: true,
  unstubGlobals: true,
  unstubEnvs: true,
  setupFiles: [SETUP, ...setupFiles],
  globalSetup: [COVERAGE_GUARD],
});

/**
 * The preset for an `@handijitcom/*` npm package: every line of the source covered, apart from
 * barrels and type-only files. Combine with the package's own settings through `mergeConfig`.
 */
const library = ({
  source = "lib",
  tests = "__tests__",
  barrels = [`${source}/index.ts`, `${source}/types/**`],
  setupFiles = [],
}: LibraryOptions = {}): ViteUserConfig => ({
  test: {
    ...common(tests, setupFiles),
    coverage: {
      provider: "v8",
      include: [`${source}/**/*.{ts,tsx}`],
      exclude: barrels,
      thresholds: { 100: true },
    },
  },
});

/**
 * The preset for an Electron desktop program: the aliases of ELECTRON_APP.md, and coverage
 * gated on the pure-logic layers at the thresholds the app has reached.
 */
const app = ({
  thresholds,
  rootDir,
  tests = "tests/unit",
  coverage = [
    "src/shared/**/*.ts",
    "src/main/services/**/*.ts",
    "src/renderer/src/hooks/**/*.{ts,tsx}",
    "src/renderer/src/helpers/**/*.ts",
    "src/renderer/src/store/**/*.ts",
  ],
  setupFiles = [],
}: AppOptions): ViteUserConfig => ({
  resolve: {
    alias: {
      "@main": resolve(rootDir, "src/main"),
      "@shared": resolve(rootDir, "src/shared"),
      "@": resolve(rootDir, "src/renderer/src"),
    },
  },
  test: {
    ...common(tests, setupFiles),
    coverage: { provider: "v8", include: coverage, thresholds },
  },
});

export type { AppOptions, LibraryOptions, Thresholds };
export { app, library };
