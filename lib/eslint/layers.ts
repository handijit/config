import type { Linter } from "eslint";

import {
  globalsWith,
  patterns,
  restrictGlobals,
  restrictImports,
} from "./patterns";
import type { ImportPattern, RestrictedGlobal } from "./patterns";

/**
 * Where a layer's code runs, which decides what it may reach:
 * - `shared`: anywhere (main, preload, a page); pure, no Node, Electron, React or DOM.
 * - `main`: Electron's main process; Node and Electron, but no React and no DOM.
 * - `preload`: the sandboxed bridge; `electron` only, no Node, no React, no schemas.
 * - `renderer`: a web page; no Node, no Electron.
 */
type Environment = "shared" | "main" | "preload" | "renderer";

/**
 * What a layer does with Zod: `forbid` it, take its `types` only (an `import type` costs
 * nothing at run time), or `allow` it.
 */
type ZodPolicy = "forbid" | "types" | "allow";

const NO_NODE = "This layer must run without Node.";
const NO_DOM = "This layer must run without a DOM.";

const IMPORTS: Record<Environment, ImportPattern[]> = {
  shared: [patterns.node, patterns.electron, patterns.react],
  main: [patterns.react],
  preload: [patterns.node, patterns.react],
  renderer: [patterns.node, patterns.electron],
};

const GLOBALS: Record<Environment, RestrictedGlobal[]> = {
  shared: [
    ...globalsWith(["Buffer", "process"], NO_NODE),
    ...globalsWith(["window", "document"], NO_DOM),
  ],
  main: globalsWith(["window", "document"], NO_DOM),
  // Electron's sandboxed preload has neither, though Node-typed code compiles with them.
  preload: globalsWith(
    ["Buffer", "setImmediate", "clearImmediate"],
    "A sandboxed preload does not have this global."
  ),
  renderer: globalsWith(
    ["Buffer", "process", "require", "__dirname", "__filename", "global"],
    "The renderer is a web page; it must run without Node."
  ),
};

const ZOD: Record<ZodPolicy, ImportPattern[]> = {
  forbid: [patterns.zod],
  types: [patterns.zodTypes],
  allow: [],
};

/** One layer's import and global restrictions. */
type LayerOptions = {
  /** A name for the config object, shown by `eslint --inspect-config`. */
  name: string;
  /** The layer's files. */
  files: string[];
  /** Where the layer's code runs. */
  environment: Environment;
  /** What the layer does with Zod. */
  zod: ZodPolicy;
  /** Further patterns the layer obeys, merged into the same rule. */
  restrict?: ImportPattern[];
};

/** The config object that keeps one layer inside its environment. */
const layer = ({
  name,
  files,
  environment,
  zod,
  restrict = [],
}: LayerOptions): Linter.Config => ({
  name,
  files,
  rules: {
    ...restrictImports([...IMPORTS[environment], ...ZOD[zod], ...restrict]),
    ...restrictGlobals(GLOBALS[environment]),
  },
});

export type { Environment, LayerOptions, ZodPolicy };
export { layer };
