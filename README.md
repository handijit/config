# @handijit/config

The tooling configuration Han Dijit's `@handijit/*` packages and Electron desktop programs
share, in one package: ESLint (flat config), Prettier, TypeScript base configs, Vitest presets
and dependency-cruiser rules, each as a **library** preset (an npm package) and an **app**
preset (an Electron program with main, preload and renderer).

- **One dependency.** The ESLint plugins the presets load are dependencies of this package;
  the tools themselves (ESLint, Prettier, TypeScript, Vitest, dependency-cruiser) are peers.
- **A few lines per repository.** A package's `eslint.config.mjs` names its layers; an app's
  names nothing at all.
- **The layer rule, twice.** ESLint rejects the import as it is typed; dependency-cruiser
  rejects it again after resolving aliases, so a renderer that reaches `electron` or main's
  code fails `verify` either way.
- **Promise mistakes caught.** Type-aware rules reject a promise nobody awaits, a promise used
  as a condition, and `await` on a value.
- **Proved on fixtures.** Every preset runs against a tiny library and a tiny Electron app in
  the tests, clean code passing and each violation caught; the smoke test does the same with
  the packed tarball through the published names.

## Install

```sh
npm install --save-dev @handijit/config eslint prettier typescript
# and what the repository uses of these:
npm install --save-dev vitest @vitest/coverage-v8 jsdom dependency-cruiser
```

Node 24 or later. ESLint 10, Prettier 3, TypeScript 6 (the house `typescript` alias, see
`NPM_PACKAGE.md`), Vitest 5, dependency-cruiser 18.

## A library (an `@handijit/*` package)

`eslint.config.mjs`:

```js
import { library } from "@handijit/config/eslint";

export default library({ rootDir: import.meta.dirname });
```

A package with entries for different processes (like `@handijit/electron-update`) names its
layers. A layer's files default to `lib/<name>.ts` and `lib/<name>/**`:

```js
import { library } from "@handijit/config/eslint";

export default library({
  rootDir: import.meta.dirname,
  react: ["lib/react.ts", "lib/react/**/*.ts", "lib/ui/**/*.tsx"],
  layers: {
    shared: {
      environment: "shared",
      files: ["lib/index.ts", "lib/shared/**/*.ts", "lib/types/**/*.ts"],
    },
    main: { environment: "main" },
    preload: { environment: "preload" },
    renderer: { environment: "renderer" },
    react: {
      environment: "renderer",
      restrict: [
        { group: ["@handijit/ui"], message: "The hook entry stays UI-free." },
      ],
    },
    ui: { environment: "renderer" },
  },
});
```

`package.json`:

```json
{
  "prettier": "@handijit/config/prettier",
  "scripts": {
    "lint": "eslint . --max-warnings 0 && prettier --check .",
    "architecture": "depcruise lib --config .dependency-cruiser.mjs",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json",
    "test": "vitest run --coverage"
  }
}
```

`tsconfig.json` (the preset includes `lib/`; add `"types": ["node"]` for code that runs in
Node or Electron's main process):

```json
{
  "extends": "@handijit/config/tsconfig/library.json"
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
import { library } from "@handijit/config/vitest";

export default library();
```

`.dependency-cruiser.mjs`:

```js
import { library } from "@handijit/config/dependency-cruiser";

export default library();
```

## An app (an Electron desktop program)

The layout of `ELECTRON_APP.md`: `src/main`, `src/preload`, `src/renderer/src`, `src/shared`,
`tests/unit`, with the aliases `@main/*`, `@/*` and `@shared/*`.

`eslint.config.mjs`:

```js
import { app } from "@handijit/config/eslint";

export default app({ rootDir: import.meta.dirname });
```

`package.json`:

```json
{
  "prettier": "@handijit/config/prettier/app",
  "scripts": {
    "lint": "eslint . --max-warnings 0 && prettier --check .",
    "architecture": "depcruise src --config .dependency-cruiser.mjs",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run --coverage"
  }
}
```

`tsconfig.node.json` (main, preload and shared, which the preset includes, with their tests;
the preset declares the aliases):

```json
{
  "extends": "@handijit/config/tsconfig/electron-node.json",
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
  "extends": "@handijit/config/tsconfig/electron-web.json",
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
import { app } from "@handijit/config/vitest";

export default app({
  rootDir: import.meta.dirname,
  thresholds: { lines: 82, functions: 84, branches: 72, statements: 80 },
});
```

`.dependency-cruiser.mjs`:

```js
import { app } from "@handijit/config/dependency-cruiser";

export default app();
```

## What the rules enforce, and why

**Every TypeScript file** (`typescript`): ESLint's and typescript-eslint's recommended rules;
`consistent-type-imports`, so a bundler can drop a type-only import; no `any`, which switches
the checker off; no `console`, since a library has no say over where its output goes and an
app logs through its logger.

**Type-aware** (`typeChecked`, on the source and the tests): `no-floating-promises` (a promise
nobody awaits loses its rejection), `no-misused-promises` (a promise as a condition is always
true; as a `void` callback its rejection is unhandled), `await-thenable`.

**A package's public surface** (`publicApi`, on `lib/`): explicit return types, so the
published declarations do not change by accident of inference.

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
importing the tests, and a library never importing a dev-only dependency at run time.

**An app, additionally** (`ELECTRON_APP.md`): no relative imports but a component's own
stylesheet; only `services/desktop.service.ts` touches `window.desktop`, so tests mock one
module; no `ipcRenderer.sendSync`, which blocks the page; the import order (main, preload and
shared: Node and external, then `electron`, then `@main`, then `@shared`, alphabetised; the
renderer: the web order of `NEXT_FRONTEND.md` with `@shared` after the page's own code and the
stylesheet last); the Rules of Hooks and the React Compiler's checks in the renderer.

**Tests**: `it.only`, `describe.only` and `test.only` are rejected, since a focused test
silently skips the rest of the suite.

**TypeScript** (`tsconfig/base.json`): `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
`noUnusedParameters`, `useUnknownInCatchVariables`, `isolatedModules`; ES2023, bundler
resolution. `electron-node.json` has the Node types and no DOM, `electron-web.json` the DOM and
no Node types, so a misplaced `document` or `process` is a type error as well.

**Vitest**: tests in node, `*.dom.test.*` in jsdom; mocks cleared and restored, stubbed globals
and environment variables undone after each test; real timers restored after each test by the
house setup file, even after a test that failed on fake ones. A library's coverage gate is
100 %, with barrels and type-only files left out.

**Prettier**: the library style (double quotes, ES5 trailing commas, 80 columns) is the
default export of `@handijit/config/prettier`; the app style (single quotes, every trailing
comma, 100 columns, bare arrow parameters), which is also the web's and `@handijit/ui`'s, is
`@handijit/config/prettier/app`.

## API

### `@handijit/config/eslint`

- `library(options)`: the package preset. Options: `rootDir` (required), `project` (default
  `./tsconfig.test.json`; `false` turns the type-aware rules off), `typed`, `source` (`lib`),
  `tests` (`__tests__/**`), `react` (globs, or `false`), `layers` (by name:
  `{ environment, files?, zod?: "forbid" | "types" | "allow", restrict? }`), `ignores`.
- `app(options)`: the app preset. Options: `rootDir` (required), `project` (default the two
  app tsconfigs), `main`, `preload`, `renderer`, `shared`, `tests`, `typed`, `desktopService`,
  `relativeImports` (default `false`), `ignores`.
- Building blocks, each returning `Linter.Config[]`: `ignores`, `typescript`, `typeChecked`,
  `publicApi`, `react`, `tests`, `scripts`, `prettier` (last); `layer` returns one config
  object; `patterns`, `restrictImports` and `restrictGlobals` compose a rule for a layer of a
  consumer's own; `GENERATED`, `SCRIPT_FILES`, `TYPESCRIPT_FILES` are the default globs.

### `@handijit/config/prettier`, `@handijit/config/prettier/app`

The default export of `./prettier` is the library style, with `library` and `app` as named
exports; `./prettier/app` exports the app style as its default.

### `@handijit/config/tsconfig/*.json`

`base.json`, `library.json`, `electron-node.json`, `electron-web.json`.

### `@handijit/config/vitest`

- `library(options?)`: `source` (`lib`), `tests` (`__tests__`), `barrels` (default
  `lib/index.ts` and `lib/types/**`), `setupFiles`.
- `app(options)`: `thresholds` and `rootDir` (required), `tests` (`tests/unit`), `coverage`
  (default the pure-logic layers), `setupFiles`.

Both return a plain Vitest config; combine with the repository's own through `mergeConfig`.
`@handijit/config/vitest/setup` is the house setup file, which both load.

### `@handijit/config/dependency-cruiser`

- `library(options?)`: `source`, `tests`, `tsConfig`, `layers` (by name:
  `{ environment, path? }`), `entries` (paths that may stand alone).
- `app(options?)`: `main`, `preload`, `renderer`, `shared`, `sharedForPreload`, `tsConfig`,
  `entries`.

## Moving an existing package over

1. `npm install --save-dev @handijit/config`, and drop `@eslint/js`, `eslint-config-prettier`
   and `typescript-eslint` from `devDependencies`.
2. Replace `eslint.config.mjs` with `library({ rootDir, layers })`; the layer blocks become
   entries of `layers`, extra patterns go to `restrict`.
3. Replace `.prettierrc` with `"prettier": "@handijit/config/prettier"` in `package.json`.
4. Reduce `tsconfig.json` to `extends` plus what is the package's own (`types`, `paths`).
5. Wrap `vitest.config.mts` in `mergeConfig(library({ barrels, setupFiles }), { ... })`, keeping
   aliases and `server.deps`; drop `vi.useRealTimers()` from the setup file.
6. Optionally add `.dependency-cruiser.mjs` and an `architecture` script.

For `@handijit/electron-update` that is six files, about 55 lines added and 205 removed, with
lint, typecheck and all 401 tests passing unchanged.

## Development

```sh
npm ci
npm run verify   # lint, architecture, typecheck, tests (100 % coverage), build, package lint, smoke test
```

- `lib/` is the source: `eslint/` (blocks, layers, the two presets), `prettier`, `vitest`,
  `dependency-cruiser`. `tsconfig/` is shipped as written.
- The repository lints, formats, cruises and tests itself with its own presets, loaded from
  the source.
- `__tests__/fixtures` holds a tiny library and a tiny Electron app (with a stand-in for
  `electron`); the tests run ESLint, tsc, Vitest and dependency-cruiser on them.
- `scripts/smoke-test.sh` unpacks the packed tarball into copies of the fixtures and runs every
  tool through the published names, offline.
- Publishing happens on a push to `master` through `.github/workflows/publish.yml`, when the
  version in `package.json` is not on npm yet.

## License

[MIT](./LICENSE)
