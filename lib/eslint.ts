// `@handijitcom/config/eslint`: the two presets and the building blocks they are made of. No logic
// here; this list is the entry's public contract.
import app from "./eslint/app";
import type { AppOptions } from "./eslint/app";
import {
  ignores,
  prettier,
  publicApi,
  react,
  scripts,
  tests,
  typeChecked,
  typescript,
} from "./eslint/blocks";
import type {
  FilesOption,
  TypeCheckedOptions,
  TypeScriptOptions,
} from "./eslint/blocks";
import { GENERATED, SCRIPT_FILES, TYPESCRIPT_FILES } from "./eslint/globs";
import { layer } from "./eslint/layers";
import type { Environment, LayerOptions, ZodPolicy } from "./eslint/layers";
import library from "./eslint/library";
import type { LibraryLayer, LibraryOptions } from "./eslint/library";
import { patterns, restrictGlobals, restrictImports } from "./eslint/patterns";
import type { ImportPattern, RestrictedGlobal } from "./eslint/patterns";

export {
  app,
  GENERATED,
  ignores,
  layer,
  library,
  patterns,
  prettier,
  publicApi,
  react,
  restrictGlobals,
  restrictImports,
  SCRIPT_FILES,
  scripts,
  tests,
  typeChecked,
  typescript,
  TYPESCRIPT_FILES,
};
export type {
  AppOptions,
  Environment,
  FilesOption,
  ImportPattern,
  LayerOptions,
  LibraryLayer,
  LibraryOptions,
  RestrictedGlobal,
  TypeCheckedOptions,
  TypeScriptOptions,
  ZodPolicy,
};
