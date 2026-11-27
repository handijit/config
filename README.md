# @handijitcom/config

[![npm version](https://img.shields.io/npm/v/@handijitcom/config.svg)](https://www.npmjs.com/package/@handijitcom/config)
[![npm downloads](https://img.shields.io/npm/dm/@handijitcom/config.svg)](https://www.npmjs.com/package/@handijitcom/config)
[![license](https://img.shields.io/npm/l/@handijitcom/config.svg)](./LICENSE)

The tooling configuration Han Dijit's `@handijitcom/*` packages and Electron desktop programs
share, in one package: ESLint (flat config), Prettier, TypeScript base configs, Vitest presets
and dependency-cruiser rules, each as a **library** preset (an npm package) and an **app**
preset (an Electron program with main, preload and renderer).

> Ported from `@handijit/config` 1.0.1, which is deprecated with the rest of the `@handijit`
> scope. See [Migrating from `@handijit/config`](#migrating-from-handijitconfig).

- **One install.** The ESLint plugins the presets load are dependencies of this package; the
  tools themselves (ESLint, Prettier, TypeScript, Vitest, dependency-cruiser) are peers.
- **A few lines per repository.** A package's `eslint.config.mjs` names its layers, if it has
  any; an app's names nothing at all.
- **The layer rule, twice.** ESLint rejects the import as it is typed; dependency-cruiser
  rejects it again after resolving aliases, so a renderer that reaches `electron` or main's code
  fails `verify` either way.
- **Promise mistakes caught.** Type-aware rules reject a promise nobody awaits, a promise used
  as a condition, and `await` on a value.
- **Proved on fixtures.** The tests apply every preset with the real tools (ESLint, TypeScript 6
  and 7, dependency-cruiser) to small fixtures, clean code passing and each violation caught; the
  smoke test runs every tool through the published names from the packed tarball.

## Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [A library (an `@handijitcom/*` package)](#a-library-an-handijitcom-package)
- [An app (an Electron desktop program)](#an-app-an-electron-desktop-program)
- [What the rules enforce, and why](#what-the-rules-enforce-and-why)
- [API](#api)
- [Adopting it in an existing package](#adopting-it-in-an-existing-package)
- [CI matrix](#ci-matrix)
- [Migrating from `@handijit/config`](#migrating-from-handijitconfig)
- [Contributing](#contributing)
- [Releasing](#releasing)
- [License](#license)

## Requirements

- Node.js 24 or later (ES modules only: every entry is an `.mjs` file with a `.d.mts`).
- ESLint 10, Prettier 3, TypeScript 6 (the `typescript` name, see below) and, for the presets
  that use them, Vitest 5 with `@vitest/coverage-v8` and `jsdom`, and dependency-cruiser 18.
- Type checking runs on TypeScript 7 (`@typescript/native`); typescript-eslint and the Rollup
  plugins use the TypeScript 6 API. A repository therefore installs both:
  `"typescript": "npm:@typescript/typescript6@^6"` and `"@typescript/native": "npm:typescript@^7"`,
  and `npx tsc -v` prints 7.

| Entry                                    | Peers it needs                           |
| ---------------------------------------- | ---------------------------------------- |
| `@handijitcom/config/eslint`             | `eslint`, `typescript`                   |
| `@handijitcom/config/prettier`, `/app`   | `prettier`                               |
| `@handijitcom/config/tsconfig/*.json`    | `typescript` / `@typescript/native`      |
| `@handijitcom/config/vitest`             | `vitest`, `@vitest/coverage-v8`, `jsdom` |
| `@handijitcom/config/dependency-cruiser` | `dependency-cruiser`                     |

## Installation

```sh
npm install --save-dev @handijitcom/config eslint prettier \
  typescript@npm:@typescript/typescript6@^6 @typescript/native@npm:typescript@^7
# and what the repository uses of these:
npm install --save-dev vitest @vitest/coverage-v8 jsdom dependency-cruiser
```

## A library (an `@handijitcom/*` package)

`eslint.config.mjs`:

```js
import { library } from "@handijitcom/config/eslint";

export default library({ rootDir: import.meta.dirname });
```

A package with entries for different processes (like `@handijitcom/electron`) names its layers.
A layer's files default to `lib/<name>.ts` and `lib/<name>/**`:

```js
import { library } from "@handijitcom/config/eslint";

export default library({
  rootDir: import.meta.dirname,
  react: ["lib/*-react.ts", "lib/*-react/**/*.ts", "lib/*-ui/**/*.tsx"],
  layers: {
    shared: {
      environment: "shared",
      files: ["lib/index.ts", "lib/shared/**/*.ts", "lib/types/**/*.ts"],
    },
    main: { environment: "main" },
    preload: { environment: "preload" },
    renderer: { environment: "renderer" },
    "update-react": {
      environment: "renderer",
      restrict: [
        {
          group: ["@handijitcom/ui"],
          message: "The hook entry stays UI-free.",
        },
      ],
    },
  },
});
```

`package.json`:

```json
{
  "prettier": "@handijitcom/config/prettier",
  "scripts": {
    "lint": "eslint . --max-warnings 0 && prettier --check .",
    "architecture": "depcruise lib --config .dependency-cruiser.mjs",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
    "test": "vitest run --coverage"
  }
}
```

`tsconfig.json` (the preset includes `lib/` and `global.d.ts`; add `"types": ["node"]` for
code that runs in Node or Electron's main process):

```json
{
  "extends": "@handijitcom/config/tsconfig/library.json"
}
```

`tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "types": ["node"] },
  "include": ["lib", "__tests__", "vitest.config.mts"]
}
```

`vitest.config.mts`:

```ts
import { library } from "@handijitcom/config/vitest";

export default library();
```

`.dependency-cruiser.mjs`:

```js
import { library } from "@handijitcom/config/dependency-cruiser";

export default library();
```

## An app (an Electron desktop program)

The layout of `ELECTRON_APP.md`: `src/main`, `src/preload`, `src/renderer/src`, `src/shared`,
`tests/unit`, with the aliases `@main/*`, `@/*` and `@shared/*`.

`eslint.config.mjs`:

```js
import { app } from "@handijitcom/config/eslint";

export default app({ rootDir: import.meta.dirname });
```

`package.json`:

```json
{
  "prettier": "@handijitcom/config/prettier/app",
  "scripts": {
    "lint": "eslint . --max-warnings 0 && prettier --check .",
    "architecture": "depcruise src --config .dependency-cruiser.mjs",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run --coverage"
  }
}
```

`tsconfig.node.json` (main, preload and shared, which the preset includes, with their tests; the
preset declares the aliases):

```json
{
  "extends": "@handijitcom/config/tsconfig/electron-node.json",
  "include": [
    "src/main",
    "src/preload",
    "src/shared",
    "tests/unit/**/*.test.ts"
  ],
  "exclude": ["tests/unit/**/*.dom.test.ts"]
}
```

`tsconfig.web.json` (the renderer and shared, with the DOM tests):

```json
{
  "extends": "@handijitcom/config/tsconfig/electron-web.json",
  "include": ["src/renderer/src", "src/shared", "tests/unit/**/*.dom.test.ts"]
}
```

`tsconfig.json`, which dependency-cruiser reads to resolve the aliases. It spells the paths out
because dependency-cruiser reads them through `tsconfig-paths`, which does not understand
TypeScript's `${configDir}`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ],
  "compilerOptions": {
    "paths": {
      "@main/*": ["./src/main/*"],
      "@/*": ["./src/renderer/src/*"],
      "@shared/*": ["./src/shared/*"]
    }
  }
}
```

`vitest.config.mts`. The thresholds are required: an app's gate is the coverage it reached,
rounded down a little, and is never lowered:

```ts
import { app } from "@handijitcom/config/vitest";

export default app({
  rootDir: import.meta.dirname,
  thresholds: { lines: 82, functions: 84, branches: 72, statements: 80 },
});
```

`.dependency-cruiser.mjs`:

```js
import { app } from "@handijitcom/config/dependency-cruiser";

export default app();
```

A Next.js site keeps `eslint-config-next` (`NEXT_FRONTEND.md` section 11) and takes only the
app Prettier style and, if it wants them, the dependency-cruiser and Vitest helpers from here.

## What the rules enforce, and why

**Every TypeScript file** (`typescript`): ESLint's and typescript-eslint's recommended rules;
`consistent-type-imports`, so a bundler can drop a type-only import; no `any`, which switches
the checker off; no `console`, since a library has no say over where its output goes and an app
logs through its logger.

**Type-aware** (`typeChecked`, on the source and the tests): `no-floating-promises` (a promise
nobody awaits loses its rejection), `no-misused-promises` (a promise as a condition is always
true; as a `void` callback its rejection is unhandled), `await-thenable`.

**A package's public surface** (`publicApi`, on `lib/`): explicit return types, so the published
declarations do not change by accident of inference.

**Layers.** Where code runs decides what it may reach:

| Environment | May not import                                                                                                  | May not use                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `shared`    | Node (`node:*` and the bare built-in names), `electron`, React; Zod as a type only (library)                    | `Buffer`, `process`, `window`, `document`                                   |
| `main`      | React, the renderer's code                                                                                      | `window`, `document`                                                        |
| `preload`   | Node, React, Zod, main's and the renderer's code; in an app also shared code other than `constants` and `types` | `Buffer`, `setImmediate`, `clearImmediate` (a sandboxed preload lacks them) |
| `renderer`  | Node, `electron`, main's code (and Zod in a library)                                                            | `Buffer`, `process`, `require`, `__dirname`, `__filename`, `global`         |

In a library, a layer may not import another layer's directory either (only a `shared` layer is
open to all); an entry builds on another by the package's published name. dependency-cruiser
enforces the same model on resolved paths, plus: no cycles (type-only cycles are allowed), no
orphans, nothing unresolvable, no package missing from `package.json`, the source never
importing the tests, and a library never importing a dev-only dependency at run time. An app's
preload may import `electron` and the `/preload` entry of any `@handijitcom/*` package (such an
entry imports only `electron`), nothing else from npm.

**An app, additionally** (`ELECTRON_APP.md`): no relative imports but a component's own
stylesheet; only `services/desktop.service.ts` touches `window.desktop`, so tests mock one
module; no `ipcRenderer.sendSync`, which blocks the page; the import order (main, preload and
shared: Node and external, then `electron`, then `@main`, then `@shared`, alphabetised; the
renderer: the web order of `NEXT_FRONTEND.md` with `@shared` after the page's own code and the
stylesheet last); the Rules of Hooks and the React Compiler's checks in the renderer.

**Tests**: `it.only`, `describe.only` and `test.only` are rejected, since a focused test silently
skips the rest of the suite.

**Scripts** (`*.mjs`, `*.cjs`, `*.js`): ESLint's recommended rules with Node and browser
globals.

**TypeScript** (`tsconfig/base.json`): `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`,
`useUnknownInCatchVariables`, `isolatedModules`; ES2023, bundler resolution, no ambient `@types`.
`library.json` adds the DOM typings; `electron-node.json` has the Node types and no DOM,
`electron-web.json` the DOM and no Node types, so a misplaced `document` or `process` is a type
error as well. Nothing in them is an option TypeScript 7 removed.

**Vitest**: tests in node, `*.dom.test.*` in jsdom; mocks cleared and restored, stubbed globals
and environment variables undone after each test; real timers restored after each test by the
house setup file, even after a test that failed on fake ones. A library's coverage gate is
100 %, with barrels and type-only files left out.

**Prettier**: the library style (double quotes, ES5 trailing commas, 80 columns, parenthesised
arrow parameters) is the default export of `@handijitcom/config/prettier`; the app style (single
quotes, every trailing comma, 100 columns, bare arrow parameters), which is also the web's and
`@handijitcom/ui`'s, is `@handijitcom/config/prettier/app`.

## API

### `@handijitcom/config/eslint`

Every function returns a `Linter.Config[]` except `layer`, which returns one config object.

`library(options)`, the package preset:

| Option    | Type                           | Default                       | Description                                                                |
| --------- | ------------------------------ | ----------------------------- | -------------------------------------------------------------------------- |
| `rootDir` | `string`                       | (required)                    | The directory of `eslint.config.*`: pass `import.meta.dirname`.            |
| `project` | `string \| string[] \| false`  | `"./tsconfig.test.json"`      | The program of the type-aware rules; `false` turns them off.               |
| `typed`   | `string[]`                     | the source and the tests      | The files linted with type information.                                    |
| `source`  | `string`                       | `"lib"`                       | The source directory (public-surface rule, layer defaults).                |
| `tests`   | `string[]`                     | `["__tests__/**/*.{ts,tsx}"]` | The test files.                                                            |
| `react`   | `string[] \| false`            | `false`                       | The files the React Hooks rules apply to.                                  |
| `layers`  | `Record<string, LibraryLayer>` | `{}`                          | `{ environment, files?, zod?: "forbid" \| "types" \| "allow", restrict? }` |
| `ignores` | `string[]`                     | `[]`                          | Ignored globs besides the generated output.                                |

A layer's `zod` defaults to `types` for shared, `allow` for main and `forbid` for preload and
renderer; `restrict` adds `no-restricted-imports` patterns to the same rule.

`app(options)`, the Electron app preset:

| Option            | Type                          | Default                                           |
| ----------------- | ----------------------------- | ------------------------------------------------- |
| `rootDir`         | `string`                      | (required)                                        |
| `project`         | `string \| string[] \| false` | `["./tsconfig.node.json", "./tsconfig.web.json"]` |
| `main`            | `string[]`                    | `["src/main/**/*.ts"]`                            |
| `preload`         | `string[]`                    | `["src/preload/**/*.ts"]`                         |
| `renderer`        | `string[]`                    | `["src/renderer/**/*.{ts,tsx}"]`                  |
| `shared`          | `string[]`                    | `["src/shared/**/*.ts"]`                          |
| `tests`           | `string[]`                    | `["tests/**/*.{ts,tsx}"]`                         |
| `typed`           | `string[]`                    | every layer and the tests                         |
| `desktopService`  | `string[]`                    | `["**/services/desktop.service.ts"]`              |
| `relativeImports` | `boolean`                     | `false` (relative imports banned)                 |
| `ignores`         | `string[]`                    | `[]`                                              |

Building blocks, for a configuration of a different shape: `ignores(extra?)`,
`typescript({ rootDir, files? })`, `typeChecked({ files, project, rootDir })`,
`publicApi({ files? })`, `react({ files? })`, `tests({ files? })`, `scripts({ files? })`,
`prettier()` (goes last), `layer({ name, files, environment, zod, restrict? })`; `patterns`
(`node`, `electron`, `react`, `zod`, `zodTypes`), `restrictImports(patterns)` and
`restrictGlobals(globals)` compose a rule for a layer of a consumer's own; `GENERATED`,
`SCRIPT_FILES` and `TYPESCRIPT_FILES` are the default globs. Types: `AppOptions`,
`LibraryOptions`, `LibraryLayer`, `LayerOptions`, `Environment`, `ZodPolicy`, `ImportPattern`,
`RestrictedGlobal`, `FilesOption`, `TypeScriptOptions`, `TypeCheckedOptions`.

### `@handijitcom/config/prettier`, `@handijitcom/config/prettier/app`

The default export of `./prettier` is the library style, with `library` and `app` as named
exports; `./prettier/app` exports the app style as its default, so `package.json` can name it.

### `@handijitcom/config/tsconfig/*.json`

`base.json`, `library.json`, `electron-node.json`, `electron-web.json`. Paths inside them use
`${configDir}`, so they resolve against the extending tsconfig's directory.

### `@handijitcom/config/vitest`

`library(options?)`: `source` (`"lib"`), `tests` (`"__tests__"`), `barrels` (files without
behaviour, left out of coverage; default `<source>/index.ts` and `<source>/types/**`),
`setupFiles` (run after the house one).

`app(options)`: `thresholds` and `rootDir` (required), `tests` (`"tests/unit"`), `coverage`
(default the pure-logic layers: shared, main's services, the renderer's hooks, helpers and
store), `setupFiles`.

Both return a plain Vitest config; combine with the repository's own through `mergeConfig`.
`@handijitcom/config/vitest/setup` is the house setup file, which both load.

### `@handijitcom/config/dependency-cruiser`

`library(options?)`: `source` (`"lib"`), `tests` (`"__tests__"`), `tsConfig` (`"tsconfig.json"`),
`layers` (by name: `{ environment, path? }`, `path` a regular expression defaulting to
`^<source>/<name>(\.tsx?$|/)`), `entries` (paths that may stand alone).

`app(options?)`: `main`, `preload`, `renderer`, `shared` (regular expressions, default
`^src/<layer>/`), `sharedForPreload` (`^src/shared/(constants|types)/`), `tsConfig`, `entries`.

## Adopting it in an existing package

The house packages (`utils`, `memoizer`, `tr`, `barcode`, `api-client`, `electron`) carry the
same configuration by hand. Switching one of them over, taking `@handijitcom/utils` as the
example:

1. **`package.json`**: add `@handijitcom/config` to `devDependencies` and drop `@eslint/js`,
   `eslint-config-prettier` and `typescript-eslint` (they come with this package). Keep `eslint`,
   `prettier`, `typescript`, `@typescript/native`, `vitest`, `@vitest/coverage-v8` and `jsdom`.
   Add `"prettier": "@handijitcom/config/prettier"`, and make `lint`
   `eslint . --max-warnings 0 && prettier --check .` (`NPM_PACKAGE.md` section 13).
2. **`.prettierrc`**: delete it; the library style is the same six options.
3. **`eslint.config.mjs`**:

   ```js
   import { library } from "@handijitcom/config/eslint";

   export default library({ rootDir: import.meta.dirname });
   ```

   A package with entries per process names them in `layers` and moves its extra patterns to
   `restrict` (see above); a single file allowed to print adds a block after the preset:
   `...library({ ... }), { files: ["lib/main/logger.ts"], rules: { "no-console": "off" } }`.

4. **`tsconfig.json`**: reduce it to what is the package's own:

   ```json
   {
     "extends": "@handijitcom/config/tsconfig/library.json",
     "compilerOptions": { "target": "ES2022", "lib": ["ES2022", "DOM"] }
   }
   ```

   The `compilerOptions` line keeps today's ES2022 API floor exactly; drop it to move to the
   preset's ES2023 (`NPM_PACKAGE.md` section 8). A package without the DOM (`tr`, `barcode`)
   writes `"lib": ["ES2022"]`; one with Node types (`electron`) adds `"types": ["node"]`, its
   `"jsx"` and its `paths`.

5. **`tsconfig.test.json`**: unchanged; it extends `./tsconfig.json`.
6. **`vitest.config.mts`** and **`vitest.setup.ts`**:

   ```ts
   import { library } from "@handijitcom/config/vitest";

   export default library({ setupFiles: ["./vitest.setup.ts"] });
   ```

   The house setup file already restores real timers, so `vitest.setup.ts` keeps only what is
   the package's own (`vi.resetModules()` in `utils`); a setup file that only restored timers
   (`tr`, `barcode`) is deleted along with the `setupFiles` option. Several barrels go to
   `barrels` (`api-client`, `electron`); aliases go through
   `mergeConfig(library({ ... }), { resolve: { alias } })`.

7. Optionally, `.dependency-cruiser.mjs` with `library()` and an `architecture` script in
   `verify`.

What changes in behaviour, all of it stricter: the type-aware promise rules and the
focused-test rule are new, plain JavaScript files (`scripts/*.mjs`, `rollup.config.mjs`) are now
linted with ESLint's recommended rules, and Vitest also undoes stubbed environment variables
(`unstubEnvs`). `project: false` turns the type-aware rules off while a package is being moved.

## CI matrix

Every `@handijitcom` repository verifies on two Node lines (`NPM_PACKAGE.md` section 14): the
**engines floor** (`engines.node` in `package.json`) and the **current Active LTS**. On a
`ci.yml` that is:

```yaml
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        # The engines floor (package.json) and the current Active LTS.
        node-version: ["24", "26"]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm run verify
```

- The release job (`publish.yml`) runs once, on the Active LTS (`node-version: "26"`).
- Node moves an even-numbered line to Active LTS every October: Node 26 since October 2026,
  Node 28 from October 2027. The second entry follows it; the first moves only with a major
  release of the package, since raising the engines floor is a breaking change.
- If the floor and the Active LTS are the same line, the matrix has one entry.

This repository's own `.github/workflows/ci.yml` and `publish.yml` are the reference copies.

## Migrating from `@handijit/config`

| `@handijit/config` 1.0.1                                                            | `@handijitcom/config` 1.0.0                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| `@handijit/config/<entry>`                                                          | `@handijitcom/config/<entry>`, same entries     |
| preload may import `@handijit/{electron,auth,subscription,electron-update}/preload` | preload may import `@handijitcom/<any>/preload` |
| `tsconfig/library.json` includes `lib`                                              | includes `lib` and `global.d.ts`                |

Replace the name in `package.json`, in every config file that imports it and in every tsconfig
`extends`; nothing else changes.

## Contributing

```sh
npm install
npm run verify   # lint, architecture, typecheck, tests (100 % coverage), build, package lint, smoke test
```

- `lib/` is the source: `eslint/` (globs, blocks, patterns, layers, the two presets) behind the
  `eslint.ts` barrel, `prettier.ts`, `vitest.ts`, `vitest-setup.ts`, `dependency-cruiser.ts`.
  `tsconfig/` ships as written.
- The repository lints, formats, cruises and tests itself with its own presets, loaded from the
  source (through `jiti` where a tool reads plain JavaScript).
- `__tests__/fixtures` holds small inputs: ESLint runs on virtual files and one typed file,
  TypeScript 6 and 7 on two tsconfig fixtures, dependency-cruiser on a library and an app that
  break rules on purpose. Unit tests only, no end-to-end tests (`NPM_PACKAGE.md` section 12).
- `scripts/smoke-test.sh` unpacks the packed tarball into a scratch library next to the installed
  tools and runs every tool through the published names, offline.

## Releasing

1. Add a `## [<version>] - <date>` section to `CHANGELOG.md`.
2. `npm version patch|minor|major`, then push to `master`.
3. `.github/workflows/publish.yml` checks that the version is not on npm yet, checks the npm
   token (`npm whoami`), reads the release notes from the changelog, runs `npm run verify` on
   the Active LTS, publishes with provenance using the repository secret `NPM_ACCESS_TOKEN`,
   tags `v<version>` and creates the GitHub Release. A push without a new version is a no-op.

## License

[MIT](./LICENSE)
