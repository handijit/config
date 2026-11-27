import js from "@eslint/js";
import type { Linter } from "eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import { GENERATED, SCRIPT_FILES, TYPESCRIPT_FILES } from "./globs";

/** The files a building block applies to. */
type FilesOption = {
  /** Glob patterns, relative to the directory of `eslint.config.*`. */
  files?: string[];
};

/** The TypeScript base: its files and the repository's root. */
type TypeScriptOptions = FilesOption & {
  /** The directory `eslint.config.*` lives in: pass `import.meta.dirname`. */
  rootDir: string;
};

/** Where type-aware rules find the TypeScript program. */
type TypeCheckedOptions = {
  /** The files linted with type information; each must belong to one of the projects. */
  files: string[];
  /** The tsconfig files, relative to `rootDir`, whose programs cover `files`. */
  project: string | string[];
  /** The directory the projects are relative to; usually `import.meta.dirname`. */
  rootDir: string;
};

/** Generated output nobody lints, plus `extra` glob patterns of the consumer's own. */
const ignores = (extra: string[] = []): Linter.Config[] => [
  globalIgnores([...GENERATED, ...extra], "handijit/ignores"),
];

/**
 * The base every TypeScript file obeys: ESLint's and typescript-eslint's recommended rules,
 * type-only imports written as such (so bundlers drop them), no `any`, no `console`.
 */
const typescript = ({
  files = TYPESCRIPT_FILES,
  rootDir,
}: TypeScriptOptions): Linter.Config[] =>
  defineConfig({
    name: "handijit/typescript",
    files,
    extends: [js.configs.recommended, tseslint.configs.recommended],
    // Named even where no rule needs types: with tsconfig files in more than one directory
    // (fixtures, examples) typescript-eslint cannot guess the root and refuses to parse.
    languageOptions: { parserOptions: { tsconfigRootDir: rootDir } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "error",
    },
  });

/**
 * Promise mistakes only the type checker can see: a promise nobody awaits (its rejection is
 * lost), a promise where a boolean or a `void` callback is expected (it is always truthy, its
 * rejection unhandled), `await` on something that is not a promise.
 */
const typeChecked = ({
  files,
  project,
  rootDir,
}: TypeCheckedOptions): Linter.Config[] =>
  defineConfig({
    name: "handijit/type-checked",
    files,
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project, tsconfigRootDir: rootDir },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  });

/** A published package's surface states its types instead of leaving them to inference. */
const publicApi = ({
  files = ["lib/**/*.{ts,tsx}"],
}: FilesOption = {}): Linter.Config[] =>
  defineConfig({
    name: "handijit/public-api",
    files,
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: { "@typescript-eslint/explicit-module-boundary-types": "error" },
  });

/** The Rules of Hooks and the React Compiler's checks, from `eslint-plugin-react-hooks`. */
const react = ({ files = ["**/*.tsx"] }: FilesOption = {}): Linter.Config[] => {
  const recommended = reactHooks.configs.flat.recommended;
  return [
    {
      name: "handijit/react",
      files,
      plugins: recommended.plugins,
      rules: recommended.rules,
    },
  ];
};

/** A focused test (`it.only`) committed by mistake silently skips the rest of the suite. */
const tests = ({
  files = ["__tests__/**/*.{ts,tsx}"],
}: FilesOption = {}): Linter.Config[] => [
  {
    name: "handijit/tests",
    files,
    rules: {
      "no-restricted-properties": [
        "error",
        ...["describe", "it", "test"].map((object) => ({
          object,
          property: "only",
          message: "A focused test skips the rest of the suite.",
        })),
      ],
    },
  },
];

/** Build and release scripts in plain JavaScript; they may run in Node or in a page. */
const scripts = ({ files = SCRIPT_FILES }: FilesOption = {}): Linter.Config[] =>
  defineConfig({
    name: "handijit/scripts",
    files,
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  });

/** Turns off every stylistic rule Prettier owns. Goes last. */
const prettier = (): Linter.Config[] => [prettierConfig];

export type { FilesOption, TypeCheckedOptions, TypeScriptOptions };
export {
  ignores,
  prettier,
  publicApi,
  react,
  scripts,
  tests,
  typeChecked,
  typescript,
};
