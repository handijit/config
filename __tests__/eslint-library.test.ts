import { ESLint } from "eslint";
import prettierConfig from "eslint-config-prettier/flat";
import { describe, expect, test } from "vitest";

import library from "../lib/eslint/library";
import type { LibraryLayer } from "../lib/eslint/library";
import { patterns } from "../lib/eslint/patterns";
import { fixture, lintText, named } from "./helpers/lint.helper";

const CWD = fixture("cruise-library");

const LAYERS: Record<string, LibraryLayer> = {
  shared: {
    environment: "shared",
    files: ["lib/index.ts", "lib/shared/**/*.ts"],
  },
  main: { environment: "main" },
  preload: { environment: "preload" },
  renderer: {
    environment: "renderer",
    restrict: [{ group: ["@handijitcom/ui"], message: "UI-free." }],
  },
};

const untyped = library({ rootDir: CWD, project: false });
const layered = library({ rootDir: CWD, project: false, layers: LAYERS });

describe("library preset", () => {
  test("should stack the blocks in order, Prettier last", () => {
    expect(library({ rootDir: CWD }).map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "handijit/ignores",
        "handijit/typescript",
        "handijit/type-checked",
        "handijit/public-api",
        "handijit/tests",
        "handijit/scripts",
      ])
    );
    expect(library({ rootDir: CWD }).at(-1)).toBe(prettierConfig);
  });

  test("should type-check the source and the tests through tsconfig.test.json by default", () => {
    const config = named(library({ rootDir: CWD }), "handijit/type-checked");
    expect(config.files).toEqual([
      "lib/**/*.{ts,tsx}",
      "__tests__/**/*.{ts,tsx}",
    ]);
    expect(config.languageOptions?.parserOptions).toEqual({
      project: "./tsconfig.test.json",
      tsconfigRootDir: CWD,
    });
  });

  test("should leave out the type-aware rules, React and layers unless asked", () => {
    const names = untyped.map(({ name }) => name);
    expect(names).not.toContain("handijit/type-checked");
    expect(names).not.toContain("handijit/react");
    expect(names.some((name) => name?.startsWith("handijit/layer/"))).toBe(
      false
    );
  });

  test("should honour every option", () => {
    const configs = library({
      rootDir: CWD,
      project: ["./a.json", "./b.json"],
      typed: ["src/**/*.ts"],
      source: "src",
      tests: ["test/**/*.ts"],
      react: ["src/**/*.tsx"],
      layers: { renderer: { environment: "renderer", zod: "allow" } },
      ignores: ["vendor/**"],
    });
    expect(named(configs, "handijit/ignores").ignores).toContain("vendor/**");
    expect(named(configs, "handijit/type-checked").files).toEqual([
      "src/**/*.ts",
    ]);
    expect(
      named(configs, "handijit/type-checked").languageOptions?.parserOptions
    ).toMatchObject({ project: ["./a.json", "./b.json"] });
    expect(named(configs, "handijit/public-api").files).toEqual([
      "src/**/*.{ts,tsx}",
    ]);
    expect(named(configs, "handijit/react").files).toEqual(["src/**/*.tsx"]);
    expect(named(configs, "handijit/tests").files).toEqual(["test/**/*.ts"]);
    const renderer = named(configs, "handijit/layer/renderer");
    expect(renderer.files).toEqual([
      "src/renderer.{ts,tsx}",
      "src/renderer/**/*.{ts,tsx}",
    ]);
    // A lone layer is sealed from nothing, and Zod is allowed on request.
    expect(renderer.rules?.["no-restricted-imports"]).toEqual([
      "error",
      { patterns: [patterns.node, patterns.electron] },
    ]);
  });

  test("should seal each layer from the others but the shared one", () => {
    const renderer = named(layered, "handijit/layer/renderer");
    expect(renderer.rules?.["no-restricted-imports"]).toEqual([
      "error",
      {
        patterns: [
          patterns.node,
          patterns.electron,
          patterns.zod,
          {
            group: ["**/main/**", "**/preload/**"],
            message:
              "Each layer is its own entry; share code through a shared layer instead.",
          },
          { group: ["@handijitcom/ui"], message: "UI-free." },
        ],
      },
    ]);
    const shared = named(layered, "handijit/layer/shared");
    expect(shared.files).toEqual(["lib/index.ts", "lib/shared/**/*.ts"]);
    expect(shared.rules?.["no-restricted-imports"]).toEqual([
      "error",
      {
        patterns: [
          patterns.node,
          patterns.electron,
          patterns.react,
          patterns.zodTypes,
          {
            group: ["**/main/**", "**/preload/**", "**/renderer/**"],
            message:
              "Each layer is its own entry; share code through a shared layer instead.",
          },
        ],
      },
    ]);
  });
});

describe("library preset, applied", () => {
  test("should reject console, any, inferred public types and value imports of types", async () => {
    expect(
      await lintText(
        untyped,
        CWD,
        "lib/log.ts",
        'export const log = (): void => {\n  console.log("x");\n};\n'
      )
    ).toEqual(["no-console"]);
    expect(
      await lintText(
        untyped,
        CWD,
        "lib/one.ts",
        "export const one = () => 1;\n"
      )
    ).toEqual(["@typescript-eslint/explicit-module-boundary-types"]);
    expect(
      await lintText(
        untyped,
        CWD,
        "lib/configs.ts",
        'import { Linter } from "eslint";\n\nexport const configs: Linter.Config[] = [];\n'
      )
    ).toEqual(["@typescript-eslint/consistent-type-imports"]);
    expect(
      await lintText(
        untyped,
        CWD,
        "__tests__/any.test.ts",
        "const id = (value: any): unknown => value;\nid(1);\n"
      )
    ).toEqual(["@typescript-eslint/no-explicit-any"]);
  });

  test("should reject a focused test", async () => {
    expect(
      await lintText(
        untyped,
        CWD,
        "__tests__/focus.test.ts",
        'import { describe, it, test } from "vitest";\n\ndescribe.only("a", () => {});\nit.only("b", () => {});\ntest.only("c", () => {});\n'
      )
    ).toEqual([
      "no-restricted-properties",
      "no-restricted-properties",
      "no-restricted-properties",
    ]);
  });

  test("should lint scripts with Node and browser globals", async () => {
    expect(
      await lintText(
        untyped,
        CWD,
        "scripts/build.mjs",
        "export const run = () => [process.argv, window.name, missing];\n"
      )
    ).toEqual(["no-undef"]);
  });

  test("should keep each layer inside its environment", async () => {
    const lint = (file: string, code: string): Promise<(string | null)[]> =>
      lintText(layered, CWD, file, code);
    const IMPORTS = ["no-restricted-imports"];
    const GLOBALS = ["no-restricted-globals"];

    // renderer: no Node (either spelling), no Electron, no Zod, no other layer, no consumer ban.
    for (const specifier of [
      "node:fs",
      "fs",
      "electron",
      "zod",
      "../main/x",
      "@handijitcom/ui",
    ]) {
      expect(
        await lint(
          "lib/renderer/a.ts",
          `import x from "${specifier}";\n\nexport const y = (): unknown => x;\n`
        )
      ).toEqual(IMPORTS);
    }
    for (const specifier of ["../shared/x", "@handijitcom/electron/renderer"]) {
      expect(
        await lint(
          "lib/renderer.ts",
          `import x from "${specifier}";\n\nexport const y = (): unknown => x;\n`
        )
      ).toEqual([]);
    }
    expect(
      await lint(
        "lib/renderer/env.ts",
        "export const env = (): unknown => process.env;\n"
      )
    ).toEqual(GLOBALS);

    // shared: Zod as a type only, no DOM.
    expect(
      await lint(
        "lib/shared/a.ts",
        'import type { ZodType } from "zod";\n\nexport type Schema = ZodType;\n'
      )
    ).toEqual([]);
    expect(
      await lint(
        "lib/shared/b.ts",
        'import { z } from "zod";\n\nexport const schema = (): unknown => z;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint("lib/index.ts", "export const w = (): unknown => window;\n")
    ).toEqual(GLOBALS);

    // main: Zod and Node allowed, React and the DOM not.
    expect(
      await lint(
        "lib/main/a.ts",
        'import { readFileSync } from "node:fs";\n\nimport { z } from "zod";\n\nexport const a = (): unknown => [readFileSync, z];\n'
      )
    ).toEqual([]);
    expect(
      await lint(
        "lib/main/b.ts",
        'import { useState } from "react";\n\nexport const b = (): unknown => useState;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint("lib/main/c.ts", "export const c = (): unknown => document;\n")
    ).toEqual(GLOBALS);

    // preload: electron only; no Zod, no globals a sandbox lacks.
    expect(
      await lint(
        "lib/preload/a.ts",
        'import { contextBridge } from "electron";\n\nexport const a = (): unknown => contextBridge;\n'
      )
    ).toEqual([]);
    for (const specifier of ["node:fs", "react"]) {
      expect(
        await lint(
          "lib/preload/d.ts",
          `import x from "${specifier}";\n\nexport const d = (): unknown => x;\n`
        )
      ).toEqual(IMPORTS);
    }
    expect(
      await lint(
        "lib/preload/b.ts",
        'import { z } from "zod";\n\nexport const b = (): unknown => z;\n'
      )
    ).toEqual(IMPORTS);
    expect(
      await lint(
        "lib/preload/c.ts",
        "export const c = (): unknown => setImmediate;\n"
      )
    ).toEqual(GLOBALS);
  });

  test("should catch a floating promise with type information", async () => {
    const cwd = fixture("typed");
    const eslint = new ESLint({
      cwd,
      overrideConfigFile: true,
      overrideConfig: library({ rootDir: cwd }),
    });
    const [result] = await eslint.lintFiles(["lib/floating.ts"]);
    expect(result?.messages.map(({ ruleId }) => ruleId)).toEqual([
      "@typescript-eslint/no-floating-promises",
    ]);
  });
});
