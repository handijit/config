// Every entry's declarations, as a TypeScript consumer of the package sees them.
import type { Linter } from "eslint";
import type { Config } from "prettier";
import type { IConfiguration } from "dependency-cruiser";
import type { ViteUserConfig } from "vitest/config";

import {
  app,
  library,
  patterns,
  restrictImports,
} from "@handijit/config/eslint";
import prettierLibrary, { app as prettierApp } from "@handijit/config/prettier";
import prettierAppDefault from "@handijit/config/prettier/app";
import {
  app as vitestApp,
  library as vitestLibrary,
} from "@handijit/config/vitest";
import { library as cruiseLibrary } from "@handijit/config/dependency-cruiser";

export const eslint: Linter.Config[] = [
  ...library({ rootDir: "." }),
  ...app({ rootDir: ".", project: false }),
  { rules: restrictImports([patterns.electron]) },
];
export const prettier: Config[] = [
  prettierLibrary,
  prettierApp,
  prettierAppDefault,
];
export const vitest: ViteUserConfig[] = [
  vitestLibrary(),
  vitestApp({
    rootDir: ".",
    thresholds: { lines: 1, functions: 1, branches: 1, statements: 1 },
  }),
];
export const cruise: IConfiguration = cruiseLibrary();
