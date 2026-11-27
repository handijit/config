#!/bin/sh
# The tests measure the source; this measures the tarball a consumer installs. It unpacks the packed
# package into a scratch library, next to this repository's installed tools (so it runs offline),
# and runs ESLint, Prettier, TypeScript 7, Vitest and dependency-cruiser through the published
# names, the way a package's own `verify` would.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# The real path: on macOS the temporary directory is reached through a symlink (/var → /private/var),
# and coverage would match no file if Vitest and the module paths disagreed on it.
WORK="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
TARBALL="$(npm pack --silent --pack-destination "$WORK" | tail -n 1)"

APP="$WORK/app"
mkdir -p "$APP/node_modules/@handijitcom/config" "$APP/lib/modules" "$APP/__tests__"
tar -xzf "$WORK/$TARBALL" -C "$APP/node_modules/@handijitcom/config" --strip-components 1

# The peers and the plugins this package depends on, as a consumer would have them installed.
for entry in "$ROOT"/node_modules/* "$ROOT"/node_modules/.bin; do
  name="$(basename "$entry")"
  [ "$name" = "@handijitcom" ] || ln -s "$entry" "$APP/node_modules/$name"
done

cd "$APP"

cat > package.json <<'JSON'
{
  "name": "smoke",
  "private": true,
  "type": "module",
  "prettier": "@handijitcom/config/prettier"
}
JSON

cat > tsconfig.json <<'JSON'
{ "extends": "@handijitcom/config/tsconfig/library.json" }
JSON

cat > tsconfig.test.json <<'JSON'
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "types": ["node"] },
  "include": ["lib", "__tests__", "vitest.config.mts"]
}
JSON

cat > eslint.config.mjs <<'JS'
import { library } from "@handijitcom/config/eslint";

export default library({ rootDir: import.meta.dirname });
JS

cat > vitest.config.mts <<'JS'
import { library } from "@handijitcom/config/vitest";

export default library();
JS

cat > .dependency-cruiser.mjs <<'JS'
import { library } from "@handijitcom/config/dependency-cruiser";

export default library();
JS

cat > lib/modules/add.ts <<'TS'
/** Adds two numbers. */
const add = (left: number, right: number): number => left + right;

export default add;
TS

cat > lib/index.ts <<'TS'
import add from "./modules/add";

export { add };
TS

cat > __tests__/index.test.ts <<'TS'
import { describe, expect, test, vi } from "vitest";

import { add } from "../lib/index";

describe("add", () => {
  test("should add", () => {
    vi.useFakeTimers();
    expect(add(1, 2)).toBe(3);
  });

  test("should run on real timers again", () => {
    expect(vi.isFakeTimers()).toBe(false);
  });
});
TS

cat > entries.mjs <<'JS'
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXPECTED = {
  "@handijitcom/config/eslint":
    "GENERATED,SCRIPT_FILES,TYPESCRIPT_FILES,app,ignores,layer,library,patterns,prettier,publicApi,react,restrictGlobals,restrictImports,scripts,tests,typeChecked,typescript",
  "@handijitcom/config/prettier": "app,default,library",
  "@handijitcom/config/prettier/app": "default",
  "@handijitcom/config/vitest": "app,library",
  "@handijitcom/config/dependency-cruiser": "app,library",
};
for (const [name, expected] of Object.entries(EXPECTED)) {
  const actual = Object.keys(await import(name)).sort().join(",");
  if (actual !== expected) throw new Error(`${name} exports ${actual}`);
}
const { default: app } = await import("@handijitcom/config/prettier/app");
if (app.singleQuote !== true || app.printWidth !== 100) {
  throw new Error("prettier/app is not the app style");
}
import.meta.resolve("@handijitcom/config/vitest/setup");
for (const name of ["base", "library", "electron-node", "electron-web"]) {
  const url = import.meta.resolve(`@handijitcom/config/tsconfig/${name}.json`);
  JSON.parse(readFileSync(fileURLToPath(url), "utf8"));
}
JS

echo "smoke: entries"
node entries.mjs

echo "smoke: eslint"
./node_modules/.bin/eslint . --max-warnings 0
printf 'export const log = (): void => {\n  console.log("x");\n};\n' > lib/log.ts
if ./node_modules/.bin/eslint lib/log.ts > /dev/null; then
  echo "smoke: the published ESLint preset let a console call through" >&2
  exit 1
fi
rm lib/log.ts

echo "smoke: prettier"
./node_modules/.bin/prettier --check lib __tests__ eslint.config.mjs vitest.config.mts

echo "smoke: typescript"
./node_modules/.bin/tsc --noEmit -p tsconfig.json
./node_modules/.bin/tsc --noEmit -p tsconfig.test.json

echo "smoke: vitest"
./node_modules/.bin/vitest run --coverage --coverage.reporter=json-summary
# A coverage gate that matched no file would pass on 0 of 0; make sure it measured the source.
node -e '
const { total } = JSON.parse(require("node:fs").readFileSync("coverage/coverage-summary.json", "utf8"));
if (total.lines.total === 0 || total.lines.pct !== 100) throw new Error("coverage measured nothing");
'

echo "smoke: dependency-cruiser"
./node_modules/.bin/depcruise lib --config .dependency-cruiser.mjs

echo "smoke: the packed tarball works through every published entry"
