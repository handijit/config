import type { Linter } from "eslint";
import importX from "eslint-plugin-import-x";

import {
  ignores,
  prettier,
  react,
  scripts,
  tests,
  typeChecked,
  typescript,
} from "./blocks";
import { layer } from "./layers";
import { restrictImports } from "./patterns";
import type { ImportPattern } from "./patterns";

/** Options of the `app` preset. Every glob is relative to the directory of `eslint.config.*`. */
type AppOptions = {
  /** The directory `eslint.config.*` lives in: pass `import.meta.dirname`. */
  rootDir: string;
  /**
   * The tsconfigs, relative to `rootDir`, whose programs cover the app and its tests, for the
   * type-aware rules. `false` turns those rules off.
   * Default `["./tsconfig.node.json", "./tsconfig.web.json"]`.
   */
  project?: string | string[] | false;
  /** Electron's main process. Default `src/main/**`. */
  main?: string[];
  /** The preload bridge. Default `src/preload/**`. */
  preload?: string[];
  /** The React page. Default `src/renderer/**`. */
  renderer?: string[];
  /** Pure code every process shares. Default `src/shared/**`. */
  shared?: string[];
  /** The unit tests. Default `tests/**`. */
  tests?: string[];
  /** The files linted with type information. Default: every layer and the tests. */
  typed?: string[];
  /** The one renderer file that may touch `window.desktop`. Default `**\/services/desktop.service.ts`. */
  desktopService?: string[];
  /** Keep relative imports legal. The house rule bans them, except a stylesheet. */
  relativeImports?: boolean;
  /** Glob patterns to ignore besides the generated output. */
  ignores?: string[];
};

const RELATIVE: ImportPattern = {
  group: ["./*", "../*", "!./*.css", "!./*.scss"],
  message:
    "Import through an alias (@main/*, @/*, @shared/*); only a component's own stylesheet is relative.",
};

const alias = (prefix: string, message: string): ImportPattern => ({
  regex: `^${prefix}/`,
  message,
});

const MAIN_CODE = alias("@main", "main's code stays in main.");
const RENDERER_CODE = alias("@", "The renderer's code stays in the renderer.");

// preload is bundled into one small file and validates nothing: schemas and helpers stay in
// main, only the channel names and the API's types cross over.
const SHARED_EXCEPT_CONSTANTS_AND_TYPES: ImportPattern = {
  regex: "^@shared/(?!(constants|types)(/|$))",
  message: "preload imports only shared constants and types.",
};

const INTERNAL = "^@(/|main/|shared/)";

/** main, preload and shared: Node and external, then electron, then @main, then @shared. */
const NODE_ORDER: Linter.RuleEntry = [
  "error",
  {
    groups: [
      ["builtin", "external"],
      "internal",
      ["parent", "sibling", "index"],
      "object",
      "unknown",
    ],
    pathGroups: [
      { pattern: "electron{,/**}", group: "external", position: "after" },
      { pattern: "@main/**", group: "internal", position: "before" },
      { pattern: "@shared/**", group: "internal", position: "after" },
    ],
    pathGroupsExcludedImportTypes: ["builtin"],
    "newlines-between": "always",
    alphabetize: { order: "asc", caseInsensitive: true },
  },
];

/**
 * The renderer: the web order (NEXT_FRONTEND.md section 5), with @shared after the page's own
 * code and the stylesheet last.
 */
const WEB_ORDER: Linter.RuleEntry = [
  "error",
  {
    groups: [
      "builtin",
      "external",
      "internal",
      ["parent", "sibling", "index"],
      "object",
      "unknown",
    ],
    pathGroups: [
      { pattern: "**/*.{css,scss}", group: "index", position: "after" },
      {
        pattern: "@/{components,containers,layouts,providers}/**",
        group: "internal",
        position: "before",
      },
      { pattern: "@/hooks/**", group: "internal", position: "before" },
      {
        pattern: "@/{services,actions}/**",
        group: "internal",
        position: "before",
      },
      { pattern: "@/store/**", group: "internal", position: "before" },
      {
        pattern: "@/{types,enums,schemas}/**",
        group: "internal",
        position: "before",
      },
      { pattern: "@shared/**", group: "internal", position: "after" },
    ],
    pathGroupsExcludedImportTypes: ["builtin"],
    "newlines-between": "always",
  },
];

const order = (
  name: string,
  files: string[],
  entry: Linter.RuleEntry
): Linter.Config => ({
  name,
  files,
  plugins: { "import-x": importX },
  settings: { "import-x/internal-regex": INTERNAL },
  rules: { "import-x/order": entry },
});

/**
 * The preset for an Electron desktop program (ELECTRON_APP.md): the TypeScript base,
 * type-aware promise rules, the layer rules (renderer, preload, main, shared), aliases instead
 * of relative imports, `window.desktop` behind one service, no synchronous IPC, the import
 * order, React Hooks in the renderer, focused-test detection, and Prettier last.
 */
const app = ({
  rootDir,
  project = ["./tsconfig.node.json", "./tsconfig.web.json"],
  main = ["src/main/**/*.ts"],
  preload = ["src/preload/**/*.ts"],
  renderer = ["src/renderer/**/*.{ts,tsx}"],
  shared = ["src/shared/**/*.ts"],
  tests: testFiles = ["tests/**/*.{ts,tsx}"],
  typed = [...main, ...preload, ...renderer, ...shared, ...testFiles],
  desktopService = ["**/services/desktop.service.ts"],
  relativeImports = false,
  ignores: extraIgnores = [],
}: AppOptions): Linter.Config[] => {
  const relative = relativeImports ? [] : [RELATIVE];
  return [
    ...ignores(extraIgnores),
    ...typescript({ rootDir }),
    ...(project === false
      ? []
      : typeChecked({ files: typed, project, rootDir })),
    ...react({ files: renderer }),
    ...tests({ files: testFiles }),
    layer({
      name: "handijit/layer/main",
      files: main,
      environment: "main",
      zod: "allow",
      restrict: [RENDERER_CODE, ...relative],
    }),
    layer({
      name: "handijit/layer/preload",
      files: preload,
      environment: "preload",
      zod: "forbid",
      restrict: [
        MAIN_CODE,
        RENDERER_CODE,
        SHARED_EXCEPT_CONSTANTS_AND_TYPES,
        ...relative,
      ],
    }),
    layer({
      name: "handijit/layer/renderer",
      files: renderer,
      environment: "renderer",
      zod: "allow",
      restrict: [MAIN_CODE, ...relative],
    }),
    layer({
      name: "handijit/layer/shared",
      files: shared,
      environment: "shared",
      zod: "allow",
      restrict: [MAIN_CODE, RENDERER_CODE, ...relative],
    }),
    {
      name: "handijit/tests/imports",
      files: testFiles,
      rules: restrictImports(relative),
    },
    {
      name: "handijit/ipc",
      files: [...preload, ...renderer],
      rules: {
        "no-restricted-properties": [
          "error",
          {
            object: "ipcRenderer",
            property: "sendSync",
            message: "Synchronous IPC blocks the page; use invoke.",
          },
          {
            object: "window",
            property: "desktop",
            message:
              "Only the desktop service touches window.desktop; tests mock it in one place.",
          },
        ],
      },
    },
    {
      name: "handijit/ipc/desktop-service",
      files: desktopService,
      rules: {
        "no-restricted-properties": [
          "error",
          {
            object: "ipcRenderer",
            property: "sendSync",
            message: "Synchronous IPC blocks the page; use invoke.",
          },
        ],
      },
    },
    order("handijit/order/node", [...main, ...preload, ...shared], NODE_ORDER),
    order("handijit/order/web", renderer, WEB_ORDER),
    ...scripts(),
    ...prettier(),
  ];
};

export type { AppOptions };
export default app;
