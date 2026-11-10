#!/bin/sh
# Installs the packed tarball into the two fixture projects and runs every tool through the
# published names (@handijit/config/eslint, .../tsconfig/library.json, ...). The tests measure
# the source; this measures the tarball a consumer installs.
#
# Offline: instead of `npm install`, the tarball is unpacked into each project's node_modules
# and the repository's own dependencies are linked next to it, which is the tree npm would
# build from this package's dependencies and peers.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SMOKE="$ROOT/scripts/smoke"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
TARBALL="$WORK/$(npm pack --silent --pack-destination "$WORK" | tail -n 1)"

# The tarball holds the built entries with their types, the tsconfig presets, the docs, and
# nothing else: no source, no tests, no fixtures.
tar -tzf "$TARBALL" | sed 's|^package/||' | sort > "$WORK/files.txt"
for expected in build/eslint.mjs build/eslint.d.mts build/prettier.mjs build/prettier-app.mjs \
  build/vitest.mjs build/vitest-setup.mjs build/dependency-cruiser.mjs \
  tsconfig/base.json tsconfig/library.json tsconfig/electron-node.json \
  tsconfig/electron-web.json README.md CHANGELOG.md LICENSE package.json; do
  grep -qx "$expected" "$WORK/files.txt" || { echo "smoke: $expected is missing from the tarball"; exit 1; }
done
if grep -Eq '^(lib|__tests__|scripts)/' "$WORK/files.txt"; then
  echo "smoke: the tarball holds files a consumer does not need:"
  grep -E '^(lib|__tests__|scripts)/' "$WORK/files.txt"
  exit 1
fi
echo "smoke: tarball contents OK ($(wc -l < "$WORK/files.txt" | tr -d ' ') files)"

# A project: a copy of a fixture, the consumer-side configs over it, and node_modules holding
# the unpacked tarball, the electron stand-in and links to everything else.
project() {
  dir="$WORK/$1"
  cp -R "$ROOT/__tests__/fixtures/$1" "$dir"
  rm -f "$dir/vitest.config.mts" "$dir/prettier.config.mjs"
  cp -R "$SMOKE/$1/." "$dir/"
  # Kept under another name in the repository: ESLint 10 looks for a config from each linted
  # file's directory, so an eslint.config.mjs there would take over the repository's own lint.
  mv "$dir/eslint.smoke.mjs" "$dir/eslint.config.mjs"
  mkdir -p "$dir/node_modules/@handijit/config"
  tar -xzf "$TARBALL" -C "$dir/node_modules/@handijit/config" --strip-components 1
  cp -R "$ROOT/__tests__/fixtures/node_modules/electron" "$dir/node_modules/electron"
  for entry in "$ROOT"/node_modules/* "$ROOT"/node_modules/.bin; do
    name="$(basename "$entry")"
    [ -e "$dir/node_modules/$name" ] || ln -s "$entry" "$dir/node_modules/$name"
  done
}

expect_failure() {
  if "$@" > "$WORK/failure.log" 2>&1; then
    echo "smoke: expected a failure from: $*"
    exit 1
  fi
}

project library
cd "$WORK/library"
node -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
manifest.prettier = "@handijit/config/prettier";
fs.writeFileSync("package.json", JSON.stringify(manifest, null, 2) + "\n");
'
BIN="$WORK/library/node_modules/.bin"
"$BIN/eslint" . --max-warnings 0
"$BIN/prettier" --check lib __tests__
"$BIN/depcruise" lib --config .dependency-cruiser.mjs
"$BIN/tsc" --noEmit -p tsconfig.json
"$BIN/tsc" --noEmit --ignoreConfig --strict --module esnext --moduleResolution bundler \
  --types node --skipLibCheck consumer.ts
"$BIN/vitest" run --coverage > "$WORK/vitest.log" 2>&1 || { cat "$WORK/vitest.log"; exit 1; }
echo "smoke: the library preset passes the library fixture"

project app
cd "$WORK/app"
echo '"@handijit/config/prettier/app"' > .prettierrc.json
BIN="$WORK/app/node_modules/.bin"
mv bad.ts bad.ts.off
"$BIN/eslint" . --max-warnings 0
"$BIN/prettier" --check src tests
"$BIN/depcruise" src --config .dependency-cruiser.mjs
"$BIN/tsc" --noEmit -p tsconfig.node.json
"$BIN/tsc" --noEmit -p tsconfig.web.json
"$BIN/vitest" run --coverage > "$WORK/vitest.log" 2>&1 || { cat "$WORK/vitest.log"; exit 1; }
# The same violation, caught by both: the renderer importing electron.
mv bad.ts.off src/renderer/src/services/bad.service.ts
expect_failure "$BIN/eslint" src/renderer
grep -q "no-restricted-imports" "$WORK/failure.log"
expect_failure "$BIN/depcruise" src --config .dependency-cruiser.mjs
grep -q "renderer-not-to-electron" "$WORK/failure.log"
echo "smoke: the app preset passes the app fixture and catches a renderer importing electron"
