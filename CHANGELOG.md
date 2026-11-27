# Changelog

All notable changes to this package are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-27

First release under the `@handijitcom` npm organization. The package is a port
of `@handijit/config` 1.0.1 (deprecated with the rest of the `@handijit` scope):
the source was recovered from the published source maps, and the presets, their
options and their rules are unchanged apart from the points below. The version
line restarts at 1.0.0.

### Changed

- Package name: `@handijit/config` → `@handijitcom/config`. Every import path
  keeps its shape (`@handijitcom/config/eslint`, `/prettier`, `/prettier/app`,
  `/vitest`, `/vitest/setup`, `/dependency-cruiser`, `/tsconfig/*.json`).
- `@handijitcom/config/dependency-cruiser`: the app preset's
  `preload-only-electron` rule lets the preload import the `/preload` entry of
  any `@handijitcom/*` package (today `@handijitcom/electron/preload`, which
  absorbed the old `auth` and `electron-update` packages). It used to list
  `@handijit/electron`, `auth`, `subscription` and `electron-update` by name.
  Any other package is still refused.
- `tsconfig/library.json` also includes `global.d.ts` next to `lib/`, as
  `NPM_PACKAGE.md` section 8 lays out; a package without one is unaffected.
- Dependencies raised to the current releases: `typescript-eslint` ^8.74.0,
  `eslint-config-prettier` ^10.1.9. The peer ranges are unchanged.

### Added

- The development files the tarball did not carry: unit tests for every preset
  (the rules each one writes, the options it honours, and ESLint, TypeScript 6
  and 7, and dependency-cruiser applying them to fixtures), a public surface
  test per entry, the tarball smoke test, the Rollup build, and the `ci.yml`
  (Node 24 and 26) and `publish.yml` workflows.
- README: adopting the presets in an existing package, and the CI matrix every
  `@handijitcom` repository uses.

[Unreleased]: https://github.com/handijit/config/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/handijit/config/releases/tag/v1.0.0
