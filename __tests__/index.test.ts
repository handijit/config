import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import * as dependencyCruiser from "../lib/dependency-cruiser";
import * as eslint from "../lib/eslint";
import * as prettier from "../lib/prettier";
import * as prettierApp from "../lib/prettier-app";
import * as vitest from "../lib/vitest";
import * as vitestSetup from "../lib/vitest-setup";

const ROOT = new URL("../", import.meta.url);

const pkg = JSON.parse(readFileSync(new URL("package.json", ROOT), "utf8")) as {
  exports: Record<string, string | { types: string; default: string }>;
};

const SURFACE: [string, object, string[]][] = [
  [
    "./eslint",
    eslint,
    [
      "GENERATED",
      "SCRIPT_FILES",
      "TYPESCRIPT_FILES",
      "app",
      "ignores",
      "layer",
      "library",
      "patterns",
      "prettier",
      "publicApi",
      "react",
      "restrictGlobals",
      "restrictImports",
      "scripts",
      "tests",
      "typeChecked",
      "typescript",
    ],
  ],
  ["./prettier", prettier, ["app", "default", "library"]],
  ["./prettier/app", prettierApp, ["default"]],
  ["./vitest", vitest, ["app", "library"]],
  ["./vitest/setup", vitestSetup, []],
  ["./dependency-cruiser", dependencyCruiser, ["app", "library"]],
];

describe("public entry points", () => {
  test.each(SURFACE)(
    "%s should expose exactly the documented surface",
    (_entry, module, expected) => {
      expect(Object.keys(module).toSorted()).toEqual(expected.toSorted());
    }
  );

  test("should declare exactly these entries, the tsconfig presets and package.json", () => {
    expect(Object.keys(pkg.exports)).toEqual([
      ...SURFACE.map(([entry]) => entry),
      "./tsconfig/*.json",
      "./package.json",
    ]);
  });

  test("should point every entry at the build of a source file, types first", () => {
    for (const [entry] of SURFACE) {
      const target = pkg.exports[entry];
      if (typeof target !== "object") throw new Error(`${entry} is not typed`);
      expect(Object.keys(target)).toEqual(["types", "default"]);
      const name = /^\.\/build\/(.+)\.mjs$/.exec(target.default)?.[1];
      expect(target.types).toBe(`./build/${name}.d.mts`);
      expect(existsSync(fileURLToPath(new URL(`lib/${name}.ts`, ROOT)))).toBe(
        true
      );
    }
  });

  test("should keep the barrels logic-free re-exports of their modules", () => {
    expect(prettierApp.default).toBe(prettier.app);
    expect(prettier.default).toBe(prettier.library);
  });
});
