import type { Linter } from "eslint";

import {
  ignores,
  prettier,
  publicApi,
  react,
  scripts,
  tests,
  typeChecked,
  typescript,
} from "./blocks";
import { layer } from "./layers";
import type { Environment, ZodPolicy } from "./layers";
import type { ImportPattern } from "./patterns";

/** A layer of a package: code that must run in one environment and is its own entry. */
type LibraryLayer = {
  /** The layer's files; defaults to `lib/<name>.ts` and `lib/<name>/**`. */
  files?: string[];
  /** Where the layer's code runs. */
  environment: Environment;
  /** Defaults: `types` for shared, `forbid` for preload and renderer, `allow` for main. */
  zod?: ZodPolicy;
  /** Further patterns the layer obeys, e.g. a sibling package it must stay free of. */
  restrict?: ImportPattern[];
};

/** Options of the `library` preset. */
type LibraryOptions = {
  /** The directory `eslint.config.*` lives in: pass `import.meta.dirname`. */
  rootDir: string;
  /**
   * The tsconfig(s), relative to `rootDir`, whose program covers the source and the tests,
   * for the type-aware rules. `false` turns those rules off. Default `./tsconfig.test.json`.
   */
  project?: string | string[] | false;
  /** The files linted with type information. Default: the source and the tests. */
  typed?: string[];
  /** The source directory. Default `lib`. */
  source?: string;
  /** The test files. Default `__tests__/**`. */
  tests?: string[];
  /** The files React Hooks rules apply to, or `false` for a package without React. */
  react?: string[] | false;
  /** The package's layers by name, for a package with entries for different environments. */
  layers?: Record<string, LibraryLayer>;
  /** Glob patterns to ignore besides the generated output. */
  ignores?: string[];
};

const DEFAULT_ZOD: Record<Environment, ZodPolicy> = {
  shared: "types",
  main: "allow",
  preload: "forbid",
  renderer: "forbid",
};

/**
 * Layers do not reach into each other's code: only a `shared` layer is importable by all.
 * A directory pattern, because a layer's directory is named after it.
 */
const sealedBy = (
  self: string,
  layers: Record<string, LibraryLayer>
): ImportPattern[] => {
  const sealed = Object.entries(layers)
    .filter(
      ([name, { environment }]) => name !== self && environment !== "shared"
    )
    .map(([name]) => `**/${name}/**`);
  return sealed.length === 0
    ? []
    : [
        {
          group: sealed,
          message:
            "Each layer is its own entry; share code through a shared layer instead.",
        },
      ];
};

/**
 * The preset for an `@handijit/*` npm package: the TypeScript base, type-aware promise rules,
 * explicit types on the public surface, focused-test detection, the layer rules of a
 * package that ships entries for main, preload and renderer, and Prettier last.
 */
const library = ({
  rootDir,
  project = "./tsconfig.test.json",
  source = "lib",
  tests: testFiles = ["__tests__/**/*.{ts,tsx}"],
  typed = [`${source}/**/*.{ts,tsx}`, ...testFiles],
  react: reactFiles = false,
  layers = {},
  ignores: extraIgnores = [],
}: LibraryOptions): Linter.Config[] => [
  ...ignores(extraIgnores),
  ...typescript({ rootDir }),
  ...(project === false ? [] : typeChecked({ files: typed, project, rootDir })),
  ...publicApi({ files: [`${source}/**/*.{ts,tsx}`] }),
  ...(reactFiles === false ? [] : react({ files: reactFiles })),
  ...tests({ files: testFiles }),
  ...Object.entries(layers).map(([name, options]) =>
    layer({
      name: `handijit/layer/${name}`,
      files: options.files ?? [
        `${source}/${name}.{ts,tsx}`,
        `${source}/${name}/**/*.{ts,tsx}`,
      ],
      environment: options.environment,
      zod: options.zod ?? DEFAULT_ZOD[options.environment],
      restrict: [...sealedBy(name, layers), ...(options.restrict ?? [])],
    })
  ),
  ...scripts(),
  ...prettier(),
];

export type { LibraryLayer, LibraryOptions };
export default library;
