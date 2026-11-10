# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-11-10

### Fixed

- `@handijit/config/dependency-cruiser`: the app preset's `preload-only-electron`
  rule now lets the preload import the `/preload` entries of `@handijit/electron`,
  `@handijit/auth`, `@handijit/subscription` and `@handijit/electron-update`, which
  every program's preload needs; any other package is still refused.

## [1.0.0] - 2026-11-10

First release: the tooling configuration the `@handijit/*` packages and the
Electron desktop programs share, as a library preset and an app preset, in five
entry points (`./eslint`, `./prettier`, `./prettier/app`, `./vitest`,
`./dependency-cruiser`), a Vitest setup file (`./vitest/setup`) and four
tsconfig presets (`./tsconfig/*.json`), as typed ES modules.

### Added

- `@handijit/config/eslint`: `library` and `app` flat-config presets for
  ESLint 10, and the building blocks they are made of (`typescript`,
  `typeChecked`, `publicApi`, `react`, `tests`, `scripts`, `ignores`,
  `prettier`, `layer`, `patterns`, `restrictImports`, `restrictGlobals`).
- **Type-aware promise rules** (`no-floating-promises`, `no-misused-promises`,
  `await-thenable`) on the source and the tests, new to every package.
- **The layer rule** for a package with entries per process (shared, main,
  preload, renderer) and for an app (`ELECTRON_APP.md` section 4): Node,
  Electron, React and Zod kept where they belong, restricted globals per
  layer, layers sealed from each other.
- For apps: aliases instead of relative imports, `window.desktop` only in the
  desktop service, no `ipcRenderer.sendSync`, the import order, React Hooks in
  the renderer.
- `@handijit/config/prettier`: the library style (default) and the app style.
- `@handijit/config/tsconfig/*.json`: `base` (the strict flag set), `library`,
  `electron-node` and `electron-web` (aliases through `${configDir}`).
- `@handijit/config/vitest`: `library` (node and jsdom projects, mocks and
  stubs reset, 100 % coverage) and `app` (aliases, coverage on the pure-logic
  layers at the app's own thresholds), and the house setup file.
- `@handijit/config/dependency-cruiser`: `library` and `app` rule sets: no
  cycles, no orphans, nothing unresolvable, no unlisted package, no dev-only
  dependency in a package's source, and the layer rule on resolved paths.

[Unreleased]: https://github.com/handijit/config/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/handijit/config/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/handijit/config/releases/tag/v1.0.0
