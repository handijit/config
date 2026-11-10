import type {
  IConfiguration,
  ICruiseOptions,
  IRegularForbiddenRuleType,
} from "dependency-cruiser";

/** Where a layer's code runs; the same model as the ESLint layers. */
type Environment = "shared" | "main" | "preload" | "renderer";

/** A layer of a package, located by a regular expression over paths. */
type LibraryLayer = {
  /** Default `^lib/<name>(\.tsx?$|/)`. */
  path?: string;
  /** Where the layer's code runs. */
  environment: Environment;
};

/** Options of the `library` preset. */
type LibraryOptions = {
  /** The source directory. Default `lib`. */
  source?: string;
  /** The test directory. Default `__tests__`. */
  tests?: string;
  /** The tsconfig whose paths resolve aliases. Default `tsconfig.json`. */
  tsConfig?: string;
  /** The package's layers by name. */
  layers?: Record<string, LibraryLayer>;
  /** Paths (regular expressions) that may stand alone, such as an entry without imports. */
  entries?: string[];
};

/** Options of the `app` preset; each layer is a regular expression over paths. */
type AppOptions = {
  /** Default `^src/main/`. */
  main?: string;
  /** Default `^src/preload/`. */
  preload?: string;
  /** Default `^src/renderer/`. */
  renderer?: string;
  /** Default `^src/shared/`. */
  shared?: string;
  /** Default `^src/shared/(constants|types)/`: all preload may take from shared. */
  sharedForPreload?: string;
  /**
   * The tsconfig whose paths resolve every alias (@main, @, @shared). Default `tsconfig.json`:
   * the app's root one, which spells the paths out, since dependency-cruiser reads them
   * through tsconfig-paths, which does not understand `${configDir}`.
   */
  tsConfig?: string;
  /** Paths (regular expressions) that may stand alone. */
  entries?: string[];
};

const ELECTRON = "(^|/)node_modules/electron/|^electron(/|$)";
const REACT = "(^|/)node_modules/react(-dom)?/|^react(-dom)?(/|$)";
/**
 * The `/preload` entries of the house packages a program's preload has to use (the bridge of
 * `@handijit/electron`, the channel helpers of `auth`, `subscription` and `electron-update`). They
 * import nothing and are bundled into the one file the sandboxed preload is.
 */
const HOUSE_PRELOAD_ENTRIES =
  "(^|/)node_modules/@handijit/(electron|auth|subscription|electron-update)/build/preload\\.|^@handijit/(electron|auth|subscription|electron-update)/preload$";
const NPM: NonNullable<IRegularForbiddenRuleType["to"]["dependencyTypes"]> = [
  "npm",
  "npm-dev",
  "npm-peer",
  "npm-optional",
  "npm-bundled",
  "npm-no-pkg",
];

const forbid = (
  name: string,
  comment: string,
  from: IRegularForbiddenRuleType["from"],
  to: IRegularForbiddenRuleType["to"]
): IRegularForbiddenRuleType => ({
  name,
  comment,
  severity: "error",
  from,
  to,
});

/** Rules every codebase obeys, whatever its shape. */
const common = (entries: string[]): IRegularForbiddenRuleType[] => [
  forbid(
    "no-circular",
    "A cycle makes load order matter and the modules impossible to understand alone. " +
      "A cycle through type-only imports leaves no trace at run time and is allowed.",
    {},
    { circular: true, viaOnly: { dependencyTypesNot: ["type-only"] } }
  ),
  forbid(
    "no-orphans",
    "A module nothing imports and that imports nothing is dead, or an entry to list.",
    {
      orphan: true,
      pathNot: [
        "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
        "\\.d\\.(c|m)?ts$",
        "(^|/)tsconfig[^/]*\\.json$",
        "(^|/)[^/]+\\.config\\.(js|cjs|mjs|ts|cts|mts)$",
        ...entries,
      ],
    },
    {}
  ),
  forbid(
    "not-to-unresolvable",
    "An import that does not resolve fails at run time.",
    {},
    { couldNotResolve: true }
  ),
  forbid(
    "no-non-package-json",
    "A package the manifest does not list works only by accident of hoisting.",
    {},
    { dependencyTypes: ["npm-no-pkg", "npm-unknown"] }
  ),
];

/** The resolution settings: TypeScript paths, `exports` maps, type-only imports marked. */
const options = (tsConfig: string): ICruiseOptions => ({
  doNotFollow: { path: "node_modules" },
  exclude: { path: "\\.(css|scss|svg|png|json)$" },
  moduleSystems: ["es6", "cjs"],
  tsPreCompilationDeps: "specify",
  tsConfig: { fileName: tsConfig },
  enhancedResolveOptions: {
    exportsFields: ["exports"],
    conditionNames: ["import", "require", "node", "default", "types"],
    extensions: [".ts", ".tsx", ".mts", ".cts", ".mjs", ".js", ".json"],
    mainFields: ["module", "main", "types", "typings"],
  },
  skipAnalysisNotInRules: true,
});

/** What each environment may not reach, as rules from a path. */
const environmentRules = (
  name: string,
  path: string,
  environment: Environment
): IRegularForbiddenRuleType[] => {
  const rules: IRegularForbiddenRuleType[] = [];
  if (environment !== "main") {
    rules.push(
      forbid(
        `${name}-not-to-node`,
        `${name} must run without Node.`,
        { path },
        { dependencyTypes: ["core"] }
      )
    );
  }
  if (environment === "shared" || environment === "renderer") {
    rules.push(
      forbid(
        `${name}-not-to-electron`,
        `${name} must run without Electron.`,
        { path },
        { path: ELECTRON, dependencyTypesNot: ["type-only"] }
      )
    );
  }
  if (environment !== "renderer") {
    rules.push(
      forbid(
        `${name}-not-to-react`,
        `${name} renders nothing.`,
        { path },
        { path: REACT, dependencyTypesNot: ["type-only"] }
      )
    );
  }
  return rules;
};

/**
 * The preset for an `@handijit/*` npm package: no cycles, no orphans, nothing unresolvable,
 * the source never importing the tests or a dev-only dependency, and the layer rules.
 * Run it over the source: `depcruise lib`.
 */
const library = ({
  source = "lib",
  tests = "__tests__",
  tsConfig = "tsconfig.json",
  layers = {},
  entries = [],
}: LibraryOptions = {}): IConfiguration => {
  const located = Object.entries(layers).map(([name, layer]) => ({
    name,
    environment: layer.environment,
    path: layer.path ?? `^${source}/${name}(\\.tsx?$|/)`,
  }));
  const sealed = located.filter(({ environment }) => environment !== "shared");
  return {
    forbidden: [
      ...common(entries),
      forbid(
        "not-to-test",
        "The published code cannot reach the tests: they are not in the tarball.",
        { path: `^${source}/` },
        { path: `^${tests}/` }
      ),
      forbid(
        "not-to-dev-dep",
        "A consumer does not install dev dependencies; a type-only import or a peer is fine.",
        { path: `^${source}/` },
        {
          dependencyTypes: ["npm-dev"],
          dependencyTypesNot: ["type-only", "npm-peer"],
        }
      ),
      ...located.flatMap(({ name, path, environment }) => [
        ...environmentRules(name, path, environment),
        ...sealed
          .filter((other) => other.name !== name)
          .map((other) =>
            forbid(
              `${name}-not-to-${other.name}`,
              "Each layer is its own entry; share code through a shared layer instead. " +
                "An import by the package's published name, which tsconfig paths point back " +
                "at the source, is how one entry builds on another and stays external.",
              { path },
              {
                path: other.path,
                dependencyTypesNot: ["aliased-tsconfig-paths"],
              }
            )
          ),
      ]),
    ],
    options: options(tsConfig),
  };
};

/**
 * The preset for an Electron desktop program, the layer rules of ELECTRON_APP.md section 4:
 * the renderer reaches only itself and shared; preload only `electron` and shared constants
 * and types; main never the renderer; shared stays pure. Run it over `src`.
 */
const app = ({
  main = "^src/main/",
  preload = "^src/preload/",
  renderer = "^src/renderer/",
  shared = "^src/shared/",
  sharedForPreload = "^src/shared/(constants|types)/",
  tsConfig = "tsconfig.json",
  entries = [],
}: AppOptions = {}): IConfiguration => ({
  forbidden: [
    ...common(entries),
    ...environmentRules("renderer", renderer, "renderer"),
    forbid(
      "renderer-not-to-main-or-preload",
      "The renderer is a web page: it reaches main only through window.desktop.",
      { path: renderer },
      { path: [main, preload] }
    ),
    ...environmentRules("preload", preload, "preload"),
    forbid(
      "preload-not-to-main-or-renderer",
      "preload is the bridge, bundled on its own.",
      { path: preload },
      { path: [main, renderer] }
    ),
    forbid(
      "preload-only-shared-constants-and-types",
      "Schemas and business logic stay in main; preload stays small.",
      { path: preload },
      { path: shared, pathNot: sharedForPreload }
    ),
    forbid(
      "preload-only-electron",
      "A sandboxed preload can require only electron and the house packages' preload entries.",
      { path: preload },
      {
        dependencyTypes: NPM,
        dependencyTypesNot: ["type-only"],
        pathNot: [ELECTRON, HOUSE_PRELOAD_ENTRIES],
      }
    ),
    forbid(
      "main-not-to-renderer-or-preload",
      "main never runs the page's or the bridge's code.",
      { path: main },
      { path: [renderer, preload] }
    ),
    ...environmentRules("main", main, "main"),
    ...environmentRules("shared", shared, "shared"),
    forbid(
      "shared-not-to-processes",
      "shared runs everywhere, so it depends on no process's code.",
      { path: shared },
      { path: [main, preload, renderer] }
    ),
  ],
  options: options(tsConfig),
});

export type { AppOptions, Environment, LibraryLayer, LibraryOptions };
export { app, library };
