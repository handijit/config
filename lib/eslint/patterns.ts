import { builtinModules } from "node:module";

import type { Linter } from "eslint";

/** One entry of the `patterns` option of the core `no-restricted-imports` rule. */
type ImportPattern = {
  /** Gitignore-style patterns; a bare name also matches a path segment of that name. */
  group?: string[];
  /** A regular expression matched against the whole specifier. Exclusive with `group`. */
  regex?: string;
  /** What the developer reads when the import is rejected. */
  message: string;
  /** Lets `import type` through: such an import leaves no trace in the output. */
  allowTypeImports?: boolean;
};

/** One entry of the core `no-restricted-globals` rule. */
type RestrictedGlobal = {
  /** The global's name. */
  name: string;
  /** What the developer reads when the global is used. */
  message: string;
};

// The bare names too, not only `node:*`: `import fs from "fs"` reaches Node just the same.
const BARE_BUILTINS = builtinModules
  .filter((name) => !name.startsWith("node:") && !name.startsWith("_"))
  .join("|");

// Regular expressions rather than groups: the group "electron" would also match
// "@handijit/electron", and the group "react" a sibling file called "./react".
const node: ImportPattern = {
  regex: `^(node:.+|(${BARE_BUILTINS})(/.*)?)$`,
  message: "This layer must run without Node.",
};

const electron: ImportPattern = {
  regex: "^electron(/.*)?$",
  message: "This layer must run without Electron.",
};

const react: ImportPattern = {
  regex: "^react(-dom)?(/.*)?$",
  message: "This layer renders nothing.",
};

const zod: ImportPattern = {
  regex: "^zod(/.*)?$",
  message: "Schemas stay in main.",
};

const zodTypes: ImportPattern = {
  ...zod,
  allowTypeImports: true,
  message:
    "This layer carries no schema library at run time; import its types only.",
};

/**
 * The import patterns the layer configs are made of, exported for a consumer that adds a
 * layer of its own. Pass a list of them to `restrictImports`.
 */
const patterns = { node, electron, react, zod, zodTypes } as const;

/**
 * The `no-restricted-imports` entry for a list of patterns. Flat config replaces a rule's
 * options instead of merging them, so a file gets one list holding every pattern it obeys.
 * An empty list writes no rule.
 */
const restrictImports = (list: ImportPattern[]): Linter.RulesRecord =>
  list.length === 0
    ? {}
    : { "no-restricted-imports": ["error", { patterns: list }] };

/** The `no-restricted-globals` entry for a list of globals. An empty list writes no rule. */
const restrictGlobals = (list: RestrictedGlobal[]): Linter.RulesRecord =>
  list.length === 0 ? {} : { "no-restricted-globals": ["error", ...list] };

/** The same message for several globals. */
const globalsWith = (names: string[], message: string): RestrictedGlobal[] =>
  names.map((name) => ({ name, message }));

export type { ImportPattern, RestrictedGlobal };
export { globalsWith, patterns, restrictGlobals, restrictImports };
