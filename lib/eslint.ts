/**
 * `@handijit/config/eslint`: flat config for ESLint 10. `library` and `app` are the composed
 * presets; the building blocks are exported for a repository that composes its own.
 */
export {
  ignores,
  prettier,
  publicApi,
  react,
  scripts,
  tests,
  typeChecked,
  typescript,
} from "./eslint/blocks";
export type {
  FilesOption,
  TypeCheckedOptions,
  TypeScriptOptions,
} from "./eslint/blocks";
export { GENERATED, SCRIPT_FILES, TYPESCRIPT_FILES } from "./eslint/globs";
export { layer } from "./eslint/layers";
export type { Environment, LayerOptions, ZodPolicy } from "./eslint/layers";
export { patterns, restrictGlobals, restrictImports } from "./eslint/patterns";
export type { ImportPattern, RestrictedGlobal } from "./eslint/patterns";
export { default as library } from "./eslint/library";
export type { LibraryLayer, LibraryOptions } from "./eslint/library";
export { default as app } from "./eslint/app";
export type { AppOptions } from "./eslint/app";
